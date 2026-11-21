use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub enum Prayer {
    Fajr,
    Dhuhr,
    Asr,
    Maghrib,
    Isha,
}

impl Prayer {
    pub const DAILY: [Self; 5] = [Self::Fajr, Self::Dhuhr, Self::Asr, Self::Maghrib, Self::Isha];
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Occurrence {
    pub name: Prayer,
    pub date: NaiveDate,
    pub time: String,
    pub instant: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Schedule {
    pub fetched_at: DateTime<Utc>,
    pub prayers: Vec<Occurrence>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveTime, TimeZone};
    use chrono_tz::Europe::Paris;

    #[test]
    fn lille_rollover_uses_tomorrows_fajr_and_the_new_dst_offset() {
        let date = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
        let tomorrow = date.succ_opt().unwrap();
        let times = [(6, 18), (13, 35), (16, 13), (18, 35), (20, 5)];
        let mut prayers = Vec::new();
        for day in [date, tomorrow] {
            for (name, (hour, minute)) in Prayer::DAILY.into_iter().zip(times) {
                let local = NaiveTime::from_hms_opt(hour, minute, 0).unwrap();
                let instant = Paris.from_local_datetime(&day.and_time(local)).unwrap();
                prayers.push(Occurrence {
                    name,
                    date: day,
                    time: local.format("%H:%M").to_string(),
                    instant: instant.with_timezone(&Utc),
                });
            }
        }
        for (index, prayer) in prayers.iter().enumerate().take(5) {
            let next = prayers.iter().find(|next| next.instant > prayer.instant).unwrap();
            assert_eq!(next.name, prayers[index + 1].name);
            assert_eq!(next.date, prayers[index + 1].date);
        }
        assert_eq!((prayers[5].instant - prayers[0].instant).num_hours(), 25);
    }
}
