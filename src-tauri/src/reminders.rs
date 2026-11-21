use crate::{
    schedule::{Occurrence, Prayer},
    state::{Language, Snapshot, Store},
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

#[derive(Clone, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub struct AlertKey {
    pub city_id: u64,
    pub date: NaiveDate,
    pub prayer: Prayer,
}

fn title(prayer: Prayer, language: Language) -> String {
    match language {
        Language::En => format!("It’s time for {}", prayer.as_str()),
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

fn notify(app: &AppHandle, occurrence: &Occurrence, snapshot: &Snapshot, city: &str) {
    // Let Windows play its configured toast sound and honor Do Not Disturb.
    if let Err(error) = app
        .notification()
        .builder()
        .title(title(occurrence.name, snapshot.saved.language))
        .body(format!("{} · {}", city, occurrence.time))
        .show()
    {
        eprintln!("Sajda notification failed: {error}");
    }
}

fn due(snapshot: &Snapshot, previous: DateTime<Utc>, now: DateTime<Utc>) -> Option<&Occurrence> {
    let location = snapshot.saved.location.as_ref()?;
    let date = now.with_timezone(&location.city.timezone).date_naive();
    location
        .schedule
        .prayers
        .iter()
        .find(|prayer| prayer.date == date && prayer.instant > previous && prayer.instant <= now)
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut previous = Utc::now();
        loop {
            tokio::time::sleep(Duration::from_millis(250)).await;
            let now = Utc::now();
            if (0..=2_000).contains(&(now - previous).num_milliseconds()) {
                let store = app.state::<Store>();
                let snapshot = store.snapshot();
                if let (Some(location), Some(prayer)) =
                    (&snapshot.saved.location, due(&snapshot, previous, now))
                {
                    let key = AlertKey {
                        city_id: location.city.id,
                        date: prayer.date,
                        prayer: prayer.name,
                    };
                    match store.claim_alert(key, prayer.instant) {
                        Ok(true) => notify(&app, prayer, &snapshot, &location.city.name),
                        Ok(false) => {}
                        Err(error) => eprintln!("Sajda could not save reminder history: {error}"),
                    }
                }
            }
            previous = now;
        }
    });
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
