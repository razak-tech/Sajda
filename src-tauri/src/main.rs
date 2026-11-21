#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod provider;
mod schedule;
mod state;
mod tray;

use tauri::Manager;

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
        .manage(provider::client().expect("failed to initialize the network client"))
        .setup(|app| {
            let path = app.path().app_local_data_dir()?.join("state.json");
            let store = state::Store::open(path)?;
            let snapshot = store.snapshot();
            app.manage(store);
            tray::install(app.handle())?;
            tray::set_menu(
                app.handle(),
                matches!(snapshot.saved.language, state::Language::Ar),
            )?;
            state::start_refresh_loop(app.handle().clone());
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
            state::refresh_schedule
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sajda");
}
