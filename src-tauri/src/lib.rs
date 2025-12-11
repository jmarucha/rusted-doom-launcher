use std::process::Command;

/// Launch GZDoom with the specified executable path and arguments.
/// This bypasses shell plugin limitations for custom GZDoom paths.
#[tauri::command]
async fn launch_gzdoom(
    gzdoom_path: String,
    args: Vec<String>,
) -> Result<(), String> {
    // Security: Validate the path looks like gzdoom
    let path_lower = gzdoom_path.to_lowercase();
    if !path_lower.contains("gzdoom") {
        return Err("Invalid GZDoom path: must contain 'gzdoom'".to_string());
    }

    // Spawn GZDoom as a detached process
    Command::new(&gzdoom_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to launch GZDoom at '{}': {}", gzdoom_path, e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .invoke_handler(tauri::generate_handler![launch_gzdoom]);

    // Enable MCP plugin for AI debugging in development builds
    #[cfg(debug_assertions)]
    {
        use log::info;
        info!("Development build: enabling MCP plugin for AI debugging");
        builder = builder.plugin(tauri_plugin_mcp::init_with_config(
            tauri_plugin_mcp::PluginConfig::new("doom-launcher".to_string())
                .start_socket_server(true),
        ));
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
