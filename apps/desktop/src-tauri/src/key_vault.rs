use std::sync::Mutex;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use keyring::Entry;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

const PBKDF2_ITERATIONS: u32 = 210_000;
const STORE_PATH: &str = "identity-vault.json";
const STORE_KEY: &str = "vault";
const KEYRING_SERVICE: &str = "vectis-desktop";
const KEYRING_USER: &str = "device-unlock-key";
const DESKTOP_VAULT_FORMAT: &str = "vectis-desktop-vault";
const KEY_BACKUP_FORMAT: &str = "vectis-key-backup";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSessionPayload {
    pub public_key_hex: String,
    pub secret_key_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupPayload {
    secret_key_hex: String,
    public_key_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KdfEnvelope {
    name: String,
    hash: String,
    iterations: u32,
    salt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CipherEnvelope {
    name: String,
    iv: String,
    ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
    format: String,
    version: u32,
    public_key_hex: String,
    password_kdf: KdfEnvelope,
    password_cipher: CipherEnvelope,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_cipher: Option<CipherEnvelope>,
    remember_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyBackupDocument {
    format: String,
    version: u32,
    created_at: String,
    public_key_hex: String,
    kdf: KdfEnvelope,
    cipher: CipherEnvelope,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub exists: bool,
    pub unlocked: bool,
    pub remember_enabled: bool,
    pub public_key_hex: Option<String>,
}

pub struct VaultRuntimeState {
    inner: Mutex<Option<AuthSessionPayload>>,
}

impl VaultRuntimeState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    fn set_unlocked(&self, session: AuthSessionPayload) {
        *self.inner.lock().expect("vault state lock") = Some(session);
    }

    fn lock(&self) {
        *self.inner.lock().expect("vault state lock") = None;
    }

    fn session(&self) -> Option<AuthSessionPayload> {
        self.inner.lock().expect("vault state lock").clone()
    }
}

fn random_bytes(length: usize) -> Vec<u8> {
    let mut bytes = vec![0_u8; length];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes
}

fn bytes_to_base64_url(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

fn base64_url_to_bytes(value: &str) -> Result<Vec<u8>, String> {
    URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|error| format!("invalid base64url: {error}"))
}

fn derive_key_from_password(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<CipherEnvelope, String> {
    let iv = random_bytes(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;
    let nonce = Nonce::from_slice(&iv);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|error| error.to_string())?;
    Ok(CipherEnvelope {
        name: "AES-GCM".to_string(),
        iv: bytes_to_base64_url(&iv),
        ciphertext: bytes_to_base64_url(&ciphertext),
    })
}

fn decrypt_bytes(key: &[u8; 32], envelope: &CipherEnvelope) -> Result<Vec<u8>, String> {
    if envelope.name != "AES-GCM" {
        return Err("unsupported cipher".to_string());
    }
    let iv = base64_url_to_bytes(&envelope.iv)?;
    let ciphertext = base64_url_to_bytes(&envelope.ciphertext)?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;
    let nonce = Nonce::from_slice(&iv);
    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "decryption failed".to_string())
}

fn payload_from_session(session: &AuthSessionPayload) -> BackupPayload {
    BackupPayload {
        secret_key_hex: session.secret_key_hex.clone(),
        public_key_hex: session.public_key_hex.clone(),
    }
}

fn session_from_payload(payload: &BackupPayload) -> Result<AuthSessionPayload, String> {
    if payload.secret_key_hex.len() != 64 || payload.public_key_hex.len() != 64 {
        return Err("invalid key material in vault payload".to_string());
    }
    Ok(AuthSessionPayload {
        secret_key_hex: payload.secret_key_hex.clone(),
        public_key_hex: payload.public_key_hex.clone(),
    })
}

fn serialize_payload(payload: &BackupPayload) -> Result<Vec<u8>, String> {
    serde_json::to_vec(payload).map_err(|error| error.to_string())
}

fn deserialize_payload(bytes: &[u8]) -> Result<BackupPayload, String> {
    serde_json::from_slice(bytes).map_err(|error| error.to_string())
}

fn load_vault_document(app: &AppHandle) -> Result<Option<VaultDocument>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|error| error.to_string())?;
    let value = store.get(STORE_KEY);
    match value {
        Some(raw) => {
            let document: VaultDocument =
                serde_json::from_value(raw).map_err(|error| error.to_string())?;
            if document.format != DESKTOP_VAULT_FORMAT || document.version != 1 {
                return Err("unsupported desktop vault format".to_string());
            }
            Ok(Some(document))
        }
        None => Ok(None),
    }
}

fn save_vault_document(app: &AppHandle, document: &VaultDocument) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|error| error.to_string())?;
    store.set(
        STORE_KEY,
        serde_json::to_value(document).map_err(|error| error.to_string())?,
    );
    store
        .save()
        .map_err(|error| error.to_string())
}

fn clear_vault_document(app: &AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|error| error.to_string())?;
    let _ = store.delete(STORE_KEY);
    store
        .save()
        .map_err(|error| error.to_string())
}

fn read_device_key() -> Result<Option<[u8; 32]>, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => {
            let bytes = base64_url_to_bytes(&value)?;
            if bytes.len() != 32 {
                return Err("device unlock key has invalid length".to_string());
            }
            let mut key = [0_u8; 32];
            key.copy_from_slice(&bytes);
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_device_key(key: &[u8; 32]) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|error| error.to_string())?;
    entry
        .set_password(&bytes_to_base64_url(key))
        .map_err(|error| error.to_string())
}

fn clear_device_key() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn decrypt_with_password(
    document: &VaultDocument,
    password: &str,
) -> Result<AuthSessionPayload, String> {
    if document.password_kdf.name != "PBKDF2" || document.password_kdf.hash != "SHA-256" {
        return Err("unsupported vault KDF".to_string());
    }
    let salt = base64_url_to_bytes(&document.password_kdf.salt)?;
    let key = derive_key_from_password(password, &salt);
    let plaintext = decrypt_bytes(&key, &document.password_cipher)?;
    let payload = deserialize_payload(&plaintext)?;
    if payload.public_key_hex != document.public_key_hex {
        return Err("vault payload public key mismatch".to_string());
    }
    session_from_payload(&payload)
}

fn decrypt_with_device_key(document: &VaultDocument) -> Result<AuthSessionPayload, String> {
    let device_cipher = document
        .device_cipher
        .as_ref()
        .ok_or_else(|| "device unlock is not configured".to_string())?;
    let device_key = read_device_key()?.ok_or_else(|| "device unlock key missing".to_string())?;
    let plaintext = decrypt_bytes(&device_key, device_cipher)?;
    let payload = deserialize_payload(&plaintext)?;
    if payload.public_key_hex != document.public_key_hex {
        return Err("vault payload public key mismatch".to_string());
    }
    session_from_payload(&payload)
}

fn build_vault_document(
    session: &AuthSessionPayload,
    password: &str,
    remember: bool,
) -> Result<VaultDocument, String> {
    if password.len() < 8 {
        return Err("vault password must be at least 8 characters".to_string());
    }

    let payload = payload_from_session(session);
    let payload_bytes = serialize_payload(&payload)?;
    let salt = random_bytes(16);
    let password_key = derive_key_from_password(password, &salt);
    let password_cipher = encrypt_bytes(&password_key, &payload_bytes)?;

    let mut device_cipher = None;
    if remember {
        let device_key = {
            if let Some(existing) = read_device_key()? {
                existing
            } else {
                let mut generated = [0_u8; 32];
                rand::thread_rng().fill_bytes(&mut generated);
                write_device_key(&generated)?;
                generated
            }
        };
        device_cipher = Some(encrypt_bytes(&device_key, &payload_bytes)?);
    } else {
        let _ = clear_device_key();
    }

    Ok(VaultDocument {
        format: DESKTOP_VAULT_FORMAT.to_string(),
        version: 1,
        public_key_hex: session.public_key_hex.clone(),
        password_kdf: KdfEnvelope {
            name: "PBKDF2".to_string(),
            hash: "SHA-256".to_string(),
            iterations: PBKDF2_ITERATIONS,
            salt: bytes_to_base64_url(&salt),
        },
        password_cipher,
        device_cipher,
        remember_enabled: remember,
    })
}

fn parse_key_backup_document(raw: &str) -> Result<KeyBackupDocument, String> {
    let document: KeyBackupDocument =
        serde_json::from_str(raw).map_err(|error| error.to_string())?;
    if document.format != KEY_BACKUP_FORMAT || document.version != 1 {
        return Err("file is not a valid Vectis encrypted key backup".to_string());
    }
    Ok(document)
}

fn restore_key_backup(document: &KeyBackupDocument, password: &str) -> Result<AuthSessionPayload, String> {
    let salt = base64_url_to_bytes(&document.kdf.salt)?;
    let key = derive_key_from_password(password, &salt);
    if document.kdf.iterations != PBKDF2_ITERATIONS {
        return Err("unsupported backup KDF parameters".to_string());
    }
    let plaintext = decrypt_bytes(&key, &document.cipher)?;
    let payload = deserialize_payload(&plaintext)?;
    if payload.public_key_hex != document.public_key_hex {
        return Err("backup payload is invalid or corrupted".to_string());
    }
    session_from_payload(&payload)
}

fn create_key_backup(session: &AuthSessionPayload, password: &str) -> Result<KeyBackupDocument, String> {
    if password.len() < 8 {
        return Err("backup password must be at least 8 characters".to_string());
    }
    let payload = payload_from_session(session);
    let payload_bytes = serialize_payload(&payload)?;
    let salt = random_bytes(16);
    let key = derive_key_from_password(password, &salt);
    let cipher = encrypt_bytes(&key, &payload_bytes)?;
    Ok(KeyBackupDocument {
        format: KEY_BACKUP_FORMAT.to_string(),
        version: 1,
        created_at: chrono::Utc::now().to_rfc3339(),
        public_key_hex: session.public_key_hex.clone(),
        kdf: KdfEnvelope {
            name: "PBKDF2".to_string(),
            hash: "SHA-256".to_string(),
            iterations: PBKDF2_ITERATIONS,
            salt: bytes_to_base64_url(&salt),
        },
        cipher,
    })
}

#[tauri::command]
pub fn desktop_vault_status(app: AppHandle, state: State<VaultRuntimeState>) -> Result<VaultStatus, String> {
    let document = load_vault_document(&app)?;
    let unlocked = state.session();
    Ok(VaultStatus {
        exists: document.is_some(),
        unlocked: unlocked.is_some(),
        remember_enabled: document
            .as_ref()
            .map(|value| value.remember_enabled)
            .unwrap_or(false),
        public_key_hex: unlocked
            .map(|session| session.public_key_hex)
            .or_else(|| document.map(|value| value.public_key_hex)),
    })
}

#[tauri::command]
pub fn desktop_vault_session(state: State<VaultRuntimeState>) -> Result<Option<AuthSessionPayload>, String> {
    Ok(state.session())
}

#[tauri::command]
pub fn desktop_vault_lock(state: State<VaultRuntimeState>) -> Result<(), String> {
    state.lock();
    Ok(())
}

#[tauri::command]
pub fn desktop_vault_try_auto_unlock(
    app: AppHandle,
    state: State<VaultRuntimeState>,
) -> Result<bool, String> {
    let Some(document) = load_vault_document(&app)? else {
        return Ok(false);
    };
    if !document.remember_enabled {
        return Ok(false);
    }
    let session = decrypt_with_device_key(&document)?;
    state.set_unlocked(session);
    Ok(true)
}

#[tauri::command]
pub fn desktop_vault_unlock(
    app: AppHandle,
    state: State<VaultRuntimeState>,
    password: String,
) -> Result<AuthSessionPayload, String> {
    let Some(document) = load_vault_document(&app)? else {
        return Err("no desktop vault found".to_string());
    };
    let session = decrypt_with_password(&document, &password)?;
    state.set_unlocked(session.clone());
    Ok(session)
}

#[tauri::command]
pub fn desktop_vault_save(
    app: AppHandle,
    state: State<VaultRuntimeState>,
    session: AuthSessionPayload,
    password: String,
    remember: bool,
) -> Result<(), String> {
    let document = build_vault_document(&session, &password, remember)?;
    save_vault_document(&app, &document)?;
    state.set_unlocked(session);
    Ok(())
}

#[tauri::command]
pub fn desktop_vault_clear(app: AppHandle, state: State<VaultRuntimeState>) -> Result<(), String> {
    clear_vault_document(&app)?;
    clear_device_key()?;
    state.lock();
    Ok(())
}

#[tauri::command]
pub fn desktop_vault_export(
    state: State<VaultRuntimeState>,
    password: String,
) -> Result<String, String> {
    let session = state
        .session()
        .ok_or_else(|| "unlock the vault before exporting a backup".to_string())?;
    let backup = create_key_backup(&session, &password)?;
    serde_json::to_string_pretty(&backup).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn desktop_vault_import(
    app: AppHandle,
    state: State<VaultRuntimeState>,
    backup_json: String,
    backup_password: String,
    vault_password: String,
    remember: bool,
) -> Result<AuthSessionPayload, String> {
    let backup = parse_key_backup_document(&backup_json)?;
    let session = restore_key_backup(&backup, &backup_password)?;
    let document = build_vault_document(&session, &vault_password, remember)?;
    save_vault_document(&app, &document)?;
    state.set_unlocked(session.clone());
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_round_trip_matches_session() {
        let session = AuthSessionPayload {
            public_key_hex: "a".repeat(64),
            secret_key_hex: "b".repeat(64),
        };
        let backup = create_key_backup(&session, "test-password-123").expect("backup");
        let restored = restore_key_backup(&backup, "test-password-123").expect("restore");
        assert_eq!(restored.public_key_hex, session.public_key_hex);
        assert_eq!(restored.secret_key_hex, session.secret_key_hex);
    }

    #[test]
    fn vault_password_round_trip() {
        let session = AuthSessionPayload {
            public_key_hex: "c".repeat(64),
            secret_key_hex: "d".repeat(64),
        };
        let document = build_vault_document(&session, "vault-password-123", false).expect("build");
        let restored = decrypt_with_password(&document, "vault-password-123").expect("decrypt");
        assert_eq!(restored.public_key_hex, session.public_key_hex);
        assert_eq!(restored.secret_key_hex, session.secret_key_hex);
    }
}
