#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clock;
mod provider;
mod reminders;
mod schedule;
mod state;
mod tray;

use tauri::Manager;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[tauri::command]
async fn search_cities(
    client: tauri::State<'_, reqwest::Client>,
    query: String,
    language: String,
) -> Result<Vec<provider::City>, String> {
    provider::search(&client, &query, if language == "ar" { "ar" } else { "en" }).await
}

#[tauri::command]
async fn load_schedule(
    client: tauri::State<'_, reqwest::Client>,
    city: provider::City,
) -> Result<schedule::Schedule, String> {
    provider::calendar(&client, &city, chrono::Utc::now()).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if !args.iter().any(|arg| arg == "--autostart") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .manage(provider::client().expect("failed to initialize the network client"))
        .setup(|app| {
            let path = app.path().app_local_data_dir()?.join("state.json");
            let store = state::Store::open(path)?;
            let mut snapshot = store.snapshot();
            if let Ok(enabled) = app.autolaunch().is_enabled() {
                if enabled != snapshot.saved.startup {
                    snapshot = store.update(|saved| saved.startup = enabled)?;
                }
            }
            app.manage(store);
            tray::install(app.handle())?;
            let window = app
                .get_webview_window("main")
                .expect("main window is configured");
            #[cfg(windows)]
            clock::install(&window)?;
            tray::set_menu(
                app.handle(),
                matches!(snapshot.saved.language, state::Language::Ar),
            )?;
            state::start_refresh_loop(app.handle().clone());
            reminders::start(app.handle().clone());
            if !std::env::args().any(|arg| arg == "--autostart") {
                window.show()?;
                window.set_focus()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tray::dismiss,
            tray::fit_window,
            search_cities,
            load_schedule,
            state::get_state,
            state::save_location,
            state::save_language,
            state::save_startup,
            state::clear_setup,
            state::refresh_schedule
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sajda");
}
