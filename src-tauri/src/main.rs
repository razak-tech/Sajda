#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod tray;
mod schedule;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            tray::install(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![tray::dismiss, tray::fit_window])
        .run(tauri::generate_context!())
        .expect("failed to run Sajda");
}
