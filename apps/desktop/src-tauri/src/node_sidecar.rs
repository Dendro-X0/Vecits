use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, State};

pub const NODE_BIND_HOST: &str = "127.0.0.1";
pub const NODE_PORT: u16 = 7878;

pub struct NodeSidecarState {
    pub child: Mutex<Option<Child>>,
    pub base_url: String,
}

impl NodeSidecarState {
    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

pub fn start_node_sidecar(app: &AppHandle) -> Result<(), String> {
    let base_url = format!("http://{NODE_BIND_HOST}:{NODE_PORT}");
    if health_ready(&base_url) {
        log::info!("vectis-node already healthy at {base_url}");
        app.manage(NodeSidecarState {
            child: Mutex::new(None),
            base_url,
        });
        return Ok(());
    }

    let binary = resolve_node_binary(app)?;
    let data_dir = resolve_data_dir(app)?;
    std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    ensure_initialized(&binary, &data_dir)?;
    let child = spawn_node_serve(&binary, &data_dir)?;
    wait_for_health(&base_url, Duration::from_secs(45))?;
    log::info!("vectis-node sidecar ready at {base_url}");

    app.manage(NodeSidecarState {
        child: Mutex::new(Some(child)),
        base_url,
    });
    Ok(())
}

pub fn stop_node_sidecar(app: &AppHandle) {
    let Some(state) = app.try_state::<NodeSidecarState>() else {
        return;
    };
    let child = {
        let Ok(mut guard) = state.child.lock() else {
            return;
        };
        guard.take()
    };
    if let Some(mut running) = child {
        let _ = running.kill();
        let _ = running.wait();
        log::info!("vectis-node sidecar stopped");
    }
}

pub fn handle_run_event(app: &AppHandle, event: &RunEvent) {
    if matches!(event, RunEvent::Exit) {
        stop_node_sidecar(app);
    }
}

#[tauri::command]
pub fn vectis_node_base_url(state: State<'_, NodeSidecarState>) -> String {
    state.base_url().to_string()
}

fn resolve_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| error.to_string())
        .map(|dir| dir.join("vectis-data"))
}

fn resolve_node_binary(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource) = app.path().resolve("vectis-node", tauri::path::BaseDirectory::Resource) {
        if resource.exists() {
            return Ok(resource);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir
        .join("..")
        .join("..")
        .join("..");
    let node_name = if cfg!(windows) {
        "vectis-node.exe"
    } else {
        "vectis-node"
    };
    let cli_name = if cfg!(windows) { "cli.exe" } else { "cli" };

    let candidates = [
        workspace_root.join("target").join("release").join(node_name),
        workspace_root.join("target").join("debug").join(node_name),
        workspace_root.join("target").join("release").join(cli_name),
        workspace_root.join("target").join("debug").join(cli_name),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(
        "vectis-node binary not found; run `cargo build --bin vectis-node` or `npm run v1:build-release`"
            .into(),
    )
}

fn ensure_initialized(binary: &Path, data_dir: &Path) -> Result<(), String> {
    if data_dir.join("manifest.json").exists() {
        return Ok(());
    }
    let status = Command::new(binary)
        .args([
            "node",
            "init",
            "--data-dir",
            &data_dir.to_string_lossy(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| format!("failed to run vectis-node init: {error}"))?;
    if !status.success() {
        return Err("vectis-node init failed".into());
    }
    Ok(())
}

fn spawn_node_serve(binary: &Path, data_dir: &Path) -> Result<Child, String> {
    let bind = format!("{NODE_BIND_HOST}:{NODE_PORT}");
    let mut command = Command::new(binary);
    command
        .args([
            "node",
            "serve",
            "--data-dir",
            &data_dir.to_string_lossy(),
            "--bind",
            &bind,
            "--ingest-rate-limit-max",
            "120",
            "--ingest-rate-limit-window-seconds",
            "60",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map_err(|error| format!("failed to spawn vectis-node serve: {error}"))
}

fn wait_for_health(base_url: &str, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if health_ready(base_url) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    Err(format!("vectis-node did not become healthy within {timeout:?}"))
}

fn health_ready(base_url: &str) -> bool {
    let url = format!("{base_url}/health");
    match ureq::get(&url).call() {
        Ok(response) => response.status() == 200,
        Err(_) => false,
    }
}
