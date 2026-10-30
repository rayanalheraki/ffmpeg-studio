mod files;
mod process;

use tauri::{Manager, RunEvent};

pub fn run() {
    let app = tauri::Builder::default()
        // Must be registered first: a second launch focuses the existing window instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(process::Processes::default())
        .invoke_handler(tauri::generate_handler![
            process::process_spawn,
            process::process_kill,
            process::process_capture,
            files::path_info,
            files::create_dir_all,
            files::remove_file,
            files::reveal_path,
            files::open_path,
            files::read_settings,
            files::write_settings,
            files::host_info,
        ])
        .build(tauri::generate_context!())
        .expect("failed to start FFmpeg Studio");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<process::Processes>().kill_all();
        }
    });
}
