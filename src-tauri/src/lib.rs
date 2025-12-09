#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init());

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
