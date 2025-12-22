use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

mod wad_parser;

/// Check if a process with the given name is running.
#[tauri::command]
async fn is_process_running(process_name: String) -> Result<bool, String> {
    let output = Command::new("pgrep")
        .arg("-x")
        .arg(&process_name)
        .output()
        .map_err(|e| format!("Failed to run pgrep: {}", e))?;

    Ok(output.status.success())
}

/// Extract level names from a WAD file's MAPINFO/ZMAPINFO/UMAPINFO/DEHACKED lumps.
/// Returns a map of level ID (e.g., "MAP01") to level name (e.g., "Entryway").
/// Only includes levels that have names defined in the WAD.
#[tauri::command]
async fn extract_wad_level_names(wad_path: String) -> Result<HashMap<String, String>, String> {
    wad_parser::extract_level_names(&wad_path)
}

/// Extract level names and save them to a JSON file alongside the WAD.
/// Creates a file named "{wad_filename}.levels.json" in the same directory.
#[tauri::command]
async fn extract_and_save_level_names(wad_path: String) -> Result<String, String> {
    let names = wad_parser::extract_level_names(&wad_path)?;

    let path = Path::new(&wad_path);
    let json_path = path.with_extension("levels.json");

    let json = serde_json::to_string_pretty(&names)
        .map_err(|e| format!("Failed to serialize level names: {}", e))?;

    std::fs::write(&json_path, &json)
        .map_err(|e| format!("Failed to write level names file: {}", e))?;

    Ok(json_path.to_string_lossy().to_string())
}

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
        .invoke_handler(tauri::generate_handler![
            launch_gzdoom,
            is_process_running,
            extract_wad_level_names,
            extract_and_save_level_names
        ]);

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
