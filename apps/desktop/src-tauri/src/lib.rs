mod key_vault;
#[cfg(not(mobile))]
mod node_sidecar;

use key_vault::VaultRuntimeState;
use tauri::Manager;

#[cfg(not(mobile))]
use node_sidecar::{handle_run_event, start_node_sidecar, vectis_node_base_url};

#[cfg(mobile)]
#[tauri::command]
fn vectis_node_base_url() -> String {
    option_env!("VECTIS_MOBILE_PINNED_NODE_URL")
        .unwrap_or("")
        .trim()
        .to_string()
}

fn mobile_release_flag() -> bool {
    matches!(
        option_env!("VECTIS_MOBILE_RELEASE"),
        Some("1") | Some("true") | Some("TRUE")
    )
}

fn inject_runtime_globals(window: &tauri::WebviewWindow, desktop_node_url: Option<&str>) -> tauri::Result<()> {
    let mobile_node_url = option_env!("VECTIS_MOBILE_PINNED_NODE_URL")
        .unwrap_or("")
        .trim()
        .to_string();
    let desktop_node_url_literal = desktop_node_url.unwrap_or("");
    let mobile_release = mobile_release_flag();

    window.eval(&format!(
        r#"
globalThis.__VECTIS_DESKTOP__ = {};
globalThis.__VECTIS_NODE_URL__ = {};
globalThis.__VECTIS_MOBILE__ = {};
globalThis.__VECTIS_MOBILE_RELEASE__ = {};
globalThis.__VECTIS_MOBILE_PINNED_NODE_URL__ = {};
"#,
        if cfg!(mobile) { "false" } else { "true" },
        serde_json::to_string(desktop_node_url_literal).unwrap_or_else(|_| "\"\"".to_string()),
        if cfg!(mobile) { "true" } else { "false" },
        if mobile_release { "true" } else { "false" },
        serde_json::to_string(&mobile_node_url).unwrap_or_else(|_| "\"\"".to_string())
    ))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(VaultRuntimeState::new())
        .invoke_handler(tauri::generate_handler![
            vectis_node_base_url,
            key_vault::desktop_vault_status,
            key_vault::desktop_vault_session,
            key_vault::desktop_vault_lock,
            key_vault::desktop_vault_try_auto_unlock,
            key_vault::desktop_vault_unlock,
            key_vault::desktop_vault_save,
            key_vault::desktop_vault_clear,
            key_vault::desktop_vault_export,
            key_vault::desktop_vault_import,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }

            #[cfg(not(mobile))]
            start_node_sidecar(&handle).map_err(|error| {
                log::error!("failed to start vectis-node sidecar: {error}");
                tauri::Error::from(std::io::Error::other(error))
            })?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(not(mobile))]
                let desktop_base_url = app
                    .state::<node_sidecar::NodeSidecarState>()
                    .base_url()
                    .to_string();

                #[cfg(not(debug_assertions))]
                {
                    #[cfg(not(mobile))]
                    inject_runtime_globals(&window, Some(&desktop_base_url))?;
                    #[cfg(mobile)]
                    inject_runtime_globals(&window, None)?;
                }
                #[cfg(debug_assertions)]
                {
                    #[cfg(not(mobile))]
                    inject_runtime_globals(&window, Some(&desktop_base_url))?;
                    #[cfg(mobile)]
                    inject_runtime_globals(&window, None)?;
                }
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running Vectis desktop")
        .run(|app_handle, event| {
            #[cfg(not(mobile))]
            handle_run_event(app_handle, &event);
        });
}
