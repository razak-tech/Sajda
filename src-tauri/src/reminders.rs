use crate::{
    clock::Reading,
    schedule::{Occurrence, Prayer},
    sound::{self, Sound},
    state::{Language, Snapshot, Store},
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

#[derive(Clone, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub struct AlertKey {
    pub city_id: u64,
    pub date: NaiveDate,
    pub prayer: Prayer,
}

fn title(prayer: Prayer, language: Language) -> String {
    match language {
        Language::En => format!("{} has started", prayer.as_str()),
        Language::Ar => format!(
            "حان وقت صلاة {}",
            match prayer {
                Prayer::Fajr => "الفجر",
                Prayer::Dhuhr => "الظهر",
                Prayer::Asr => "العصر",
                Prayer::Maghrib => "المغرب",
                Prayer::Isha => "العشاء",
            }
        ),
    }
}

fn notify(app: &AppHandle, occurrence: &Occurrence, language: Language, city: &str, sound: Sound) {
    tauri::async_runtime::spawn(sound::preview_sound(sound));
    if let Some(window) = app.get_webview_window("edge") {
        if window.emit("prayer-alert", occurrence).is_ok() {
            return;
        }
    }
    if let Err(error) = app
        .notification()
        .builder()
        .title(title(occurrence.name, language))
        .body(format!("{} · {}", city, occurrence.time))
        .show()
    {
        eprintln!("Sajda notification failed: {error}");
    }
}

pub fn due(
    snapshot: &Snapshot,
    previous: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Option<&Occurrence> {
    let location = snapshot.saved.location.as_ref()?;
    let date = now.with_timezone(&location.city.timezone).date_naive();
    location
        .schedule
        .prayers
        .iter()
        .find(|prayer| prayer.date == date && prayer.instant > previous && prayer.instant <= now)
}

pub fn start(app: AppHandle) -> tauri_plugin_notification::Result<()> {
    let handle = app.clone();
    app.notification().on_action(move |action| {
        if action.action_id() == "tap" {
            let app = handle.clone();
            let _ = handle.run_on_main_thread(move || {
                crate::edge::request_action(&app, crate::edge::EdgeAction::Open);
            });
        }
    })?;
    tauri::async_runtime::spawn(async move {
        let mut previous = Reading::now();
        loop {
            tokio::time::sleep(Duration::from_millis(250)).await;
            let now = Reading::now();
            if now.should_refresh(&previous) {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::state::refresh_schedule(app).await;
                });
            }
            if now.may_dispatch(&previous) {
                let store = app.state::<Store>();
                match store.claim_due(previous.utc, now.utc) {
                    Ok(Some((prayer, language, city, sound))) => {
                        notify(&app, &prayer, language, &city, sound)
                    }
                    Ok(None) => {}
                    Err(error) => eprintln!("Sajda could not save reminder history: {error}"),
                }
            }
            previous = now;
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{provider::City, schedule::Schedule, state::Location};

    #[test]
    fn only_the_crossed_prayer_is_due() {
        let instant = DateTime::parse_from_rfc3339("2026-11-21T16:21:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut snapshot = Snapshot::default();
        snapshot.saved.location = Some(Location {
            city: City {
                id: 1,
                name: "Lille".into(),
                admin1: None,
                country: "France".into(),
                country_code: "FR".into(),
                timezone: chrono_tz::Europe::Paris,
                latitude: 50.63,
                longitude: 3.06,
            },
            schedule: Schedule {
                fetched_at: instant,
                prayers: vec![Occurrence {
                    name: Prayer::Maghrib,
                    date: instant.date_naive(),
                    time: "17:21".into(),
                    instant,
                }],
            },
        });
        let before = instant - chrono::Duration::milliseconds(250);
        assert!(due(&snapshot, before, instant).is_some());
        assert!(due(&snapshot, before, before).is_none());
        assert!(
            due(
                &snapshot,
                instant,
                instant + chrono::Duration::milliseconds(250)
            )
            .is_none()
        );
    }
}
