use crate::{
    provider::{self, City},
    schedule::Schedule,
    tray,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;

#[derive(Clone, Deserialize, Serialize)]
pub struct Location {
    pub city: City,
    pub schedule: Schedule,
}

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    En,
    Ar,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct Saved {
    pub location: Option<Location>,
    pub language: Language,
    pub startup: bool,
    pub setup_city: Option<City>,
}

#[derive(Clone, Default, Serialize)]
pub struct Snapshot {
    #[serde(flatten)]
    pub saved: Saved,
    pub offline: bool,
    pub refreshing: bool,
    pub revision: u64,
}

pub struct Store {
    path: PathBuf,
    state: Mutex<Snapshot>,
}

impl Store {
    pub fn open(path: PathBuf) -> io::Result<Self> {
        let saved = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(io::Error::other)?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => Saved::default(),
            Err(error) => return Err(error),
        };
        Ok(Self {
            path,
            state: Mutex::new(Snapshot {
                saved,
                ..Snapshot::default()
            }),
        })
    }

    pub fn snapshot(&self) -> Snapshot {
        self.state.lock().expect("Sajda state lock").clone()
    }

    pub fn update(&self, change: impl FnOnce(&mut Saved)) -> Result<Snapshot, String> {
        let mut snapshot = self.state.lock().expect("Sajda state lock");
        let mut saved = snapshot.saved.clone();
        change(&mut saved);
        self.persist(&saved).map_err(|e| e.to_string())?;
        snapshot.saved = saved;
        snapshot.revision += 1;
        Ok(snapshot.clone())
    }

    fn persist(&self, saved: &Saved) -> io::Result<()> {
        let dir = self
            .path
            .parent()
            .ok_or_else(|| io::Error::other("Missing state directory"))?;
        fs::create_dir_all(dir)?;
        let mut file = tempfile::NamedTempFile::new_in(dir)?;
        serde_json::to_writer(file.as_file_mut(), saved).map_err(io::Error::other)?;
        file.flush()?;
        file.as_file().sync_all()?;
        file.persist(&self.path).map_err(|error| error.error)?;
        Ok(())
    }
}

fn publish(app: &AppHandle, snapshot: &Snapshot) {
    let _ = app.emit("state-changed", snapshot);
}

#[tauri::command]
pub fn get_state(store: State<'_, Store>) -> Snapshot {
    store.snapshot()
}

#[tauri::command]
pub fn save_language(
    app: AppHandle,
    store: State<'_, Store>,
    language: Language,
) -> Result<(), String> {
    let snapshot = store.update(|saved| saved.language = language)?;
    let _ = tray::set_menu(&app, matches!(language, Language::Ar));
    publish(&app, &snapshot);
    Ok(())
}

#[tauri::command]
pub fn save_startup(
    app: AppHandle,
    store: State<'_, Store>,
    enabled: bool,
    setup_city: Option<City>,
) -> Result<Snapshot, String> {
    let startup = app.autolaunch();
    let previous = startup.is_enabled().map_err(|error| error.to_string())?;
    let set = |enabled| {
        if enabled {
            startup.enable()
        } else {
            startup.disable()
        }
    };
    if previous != enabled {
        set(enabled).map_err(|error| error.to_string())?;
    }
    let result = store.update(|saved| {
        saved.startup = enabled;
        if setup_city.is_some() && saved.location.is_none() {
            saved.setup_city = setup_city;
        }
    });
    if let Ok(snapshot) = &result {
        publish(&app, snapshot);
    } else if previous != enabled {
        let _ = set(previous);
    }
    result
}

#[tauri::command]
pub fn clear_setup(app: AppHandle, store: State<'_, Store>) -> Result<(), String> {
    let snapshot = store.update(|saved| saved.setup_city = None)?;
    publish(&app, &snapshot);
    Ok(())
}

#[tauri::command]
pub fn save_location(
    app: AppHandle,
    store: State<'_, Store>,
    location: Location,
) -> Result<Snapshot, String> {
    let mut state = store.state.lock().expect("Sajda state lock");
    let mut saved = state.saved.clone();
    saved.location = Some(location);
    saved.setup_city = None;
    store.persist(&saved).map_err(|e| e.to_string())?;
    state.saved = saved;
    state.offline = false;
    state.revision += 1;
    let snapshot = state.clone();
    drop(state);
    publish(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn refresh_schedule(app: AppHandle) -> Result<(), String> {
    refresh(&app, true).await
}

async fn refresh(app: &AppHandle, force: bool) -> Result<(), String> {
    let store = app.state::<Store>();
    let now = Utc::now();
    let location = {
        let mut state = store.state.lock().expect("Sajda state lock");
        let Some(location) = state.saved.location.clone() else {
            return Ok(());
        };
        if state.refreshing || (!force && !state.offline && !location.needs_refresh(now)) {
            return Ok(());
        }
        state.refreshing = true;
        state.revision += 1;
        publish(app, &state);
        location
    };

    let client = app.state::<reqwest::Client>();
    let result = provider::calendar(&client, &location.city, now).await;
    let mut state = store.state.lock().expect("Sajda state lock");
    state.refreshing = false;
    state.revision += 1;

    // A city change or a newer fetch wins over a refresh already in flight.
    let unchanged = state.saved.location.as_ref().is_some_and(|current| {
        current.city.id == location.city.id
            && current.schedule.fetched_at == location.schedule.fetched_at
    });
    let result = if unchanged {
        let result = result.and_then(|schedule| {
            let mut saved = state.saved.clone();
            saved.location = Some(Location {
                city: location.city,
                schedule,
            });
            store.persist(&saved).map_err(|e| e.to_string())?;
            state.saved = saved;
            Ok(())
        });
        state.offline = result.is_err();
        result
    } else {
        Ok(())
    };
    publish(app, &state);
    result
}

impl Location {
    fn needs_refresh(&self, now: chrono::DateTime<Utc>) -> bool {
        if now < self.schedule.fetched_at || now - self.schedule.fetched_at >= Duration::days(1) {
            return true;
        }
        let today = now.with_timezone(&self.city.timezone).date_naive();
        let first = self.schedule.prayers.first();
        let last = self.schedule.prayers.last();
        first.is_none_or(|prayer| prayer.date > today)
            || last.is_none_or(|prayer| (prayer.date - today).num_days() <= 2)
    }
}

pub fn start_refresh_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let _ = refresh(&app, true).await;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(300)).await;
            let _ = refresh(&app, false).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_survive_restart_and_atomic_replacement() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("state.json");
        let store = Store::open(path.clone()).unwrap();
        store.update(|saved| saved.language = Language::En).unwrap();
        store.update(|saved| saved.language = Language::Ar).unwrap();
        let reopened = Store::open(path).unwrap();
        assert!(matches!(reopened.snapshot().saved.language, Language::Ar));
    }
}
