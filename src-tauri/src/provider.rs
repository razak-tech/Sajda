use crate::schedule::{Occurrence, Prayer, Schedule};
use chrono::{DateTime, Datelike, Days, NaiveDate, Utc};
use chrono_tz::Tz;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    time::Duration,
};

pub const CACHE_DAYS: u64 = 14;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct City {
    pub id: u64,
    pub name: String,
    pub admin1: Option<String>,
    pub country: String,
    pub country_code: String,
    pub timezone: Tz,
    pub latitude: f64,
    pub longitude: f64,
}

impl City {
    fn valid(&self) -> bool {
        self.id > 0
            && !self.name.trim().is_empty()
            && !self.country.trim().is_empty()
            && (-90.0..=90.0).contains(&self.latitude)
            && (-180.0..=180.0).contains(&self.longitude)
    }
}

#[derive(Deserialize)]
struct SearchResponse {
    #[serde(default)]
    results: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct Calendar {
    code: u16,
    data: Vec<CalendarDay>,
}

#[derive(Deserialize)]
struct CalendarDay {
    date: CalendarDate,
    timings: HashMap<String, String>,
    meta: CalendarMetadata,
}

#[derive(Deserialize)]
struct CalendarDate {
    gregorian: GregorianDate,
}

#[derive(Deserialize)]
struct GregorianDate {
    date: String,
}

#[derive(Deserialize)]
struct CalendarMetadata {
    timezone: Tz,
}

pub fn client() -> reqwest::Result<Client> {
    Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent(concat!("Sajda/", env!("CARGO_PKG_VERSION")))
        .build()
}

pub async fn search(client: &Client, query: &str, language: &str) -> Result<Vec<City>, String> {
    let query = query.trim();
    if !(2..=100).contains(&query.chars().count()) {
        return Ok(Vec::new());
    }
    let response = client
        .get("https://geocoding-api.open-meteo.com/v1/search")
        .query(&[("name", query), ("count", "8"), ("language", language)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<SearchResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response
        .results
        .into_iter()
        .filter_map(|result| serde_json::from_value::<City>(result).ok())
        .filter(City::valid)
        .collect())
}

#[derive(Deserialize)]
struct IpLocation {
    city: String,
    country_code: String,
    timezone: Tz,
    latitude: f64,
    longitude: f64,
}

pub async fn detect_city(client: &Client) -> Result<City, String> {
    let location = client
        .get("https://ipapi.co/json/")
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| error.to_string())?
        .json::<IpLocation>()
        .await
        .map_err(|error| error.to_string())?;
    let distance = |city: &City| {
        let latitude = city.latitude - location.latitude;
        let longitude = (city.longitude - location.longitude + 180.0).rem_euclid(360.0) - 180.0;
        latitude.hypot(longitude * location.latitude.to_radians().cos())
    };
    search(client, &location.city, "en")
        .await?
        .into_iter()
        .filter(|city| {
            city.country_code == location.country_code && city.timezone == location.timezone
        })
        .filter(|city| distance(city) < 0.7)
        .min_by(|a, b| distance(a).total_cmp(&distance(b)))
        .ok_or_else(|| "No matching city".into())
}

pub async fn calendar(
    client: &Client,
    city: &City,
    now: DateTime<Utc>,
) -> Result<Schedule, String> {
    if !city.valid() {
        return Err("Invalid city".into());
    }
    let today = now.with_timezone(&city.timezone).date_naive();
    let end = today
        .checked_add_days(Days::new(CACHE_DAYS - 1))
        .ok_or("Invalid date")?;
    let mut days = fetch_month(client, city, today, today, end).await?;
    if (today.year(), today.month()) != (end.year(), end.month()) {
        days.extend(fetch_month(client, city, end, today, end).await?);
    }
    if days.len() != CACHE_DAYS as usize {
        return Err("Incomplete prayer schedule".into());
    }
    let prayers: Vec<_> = days.into_values().flatten().collect();
    if !prayers
        .windows(2)
        .all(|pair| pair[0].instant < pair[1].instant)
    {
        return Err("Prayer times are out of order".into());
    }
    Ok(Schedule {
        fetched_at: Utc::now(),
        prayers,
    })
}

async fn fetch_month(
    client: &Client,
    city: &City,
    month: NaiveDate,
    start: NaiveDate,
    end: NaiveDate,
) -> Result<BTreeMap<NaiveDate, Vec<Occurrence>>, String> {
    let url = format!(
        "https://api.aladhan.com/v1/calendar/{}/{}",
        month.year(),
        month.month()
    );
    let response = client
        .get(url)
        .query(&[
            ("latitude", city.latitude.to_string()),
            ("longitude", city.longitude.to_string()),
            ("timezonestring", city.timezone.to_string()),
            ("iso8601", "true".into()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Calendar>()
        .await
        .map_err(|e| e.to_string())?;
    if response.code != 200 {
        return Err("The prayer schedule provider returned an error".into());
    }
    let mut days = BTreeMap::new();
    for entry in response.data {
        let date = NaiveDate::parse_from_str(&entry.date.gregorian.date, "%d-%m-%Y")
            .map_err(|e| e.to_string())?;
        if date < start || date > end {
            continue;
        }
        if entry.meta.timezone != city.timezone
            || (date.year(), date.month()) != (month.year(), month.month())
        {
            return Err("Unexpected schedule date or time zone".into());
        }
        let prayers = Prayer::DAILY
            .into_iter()
            .map(|name| {
                let raw = entry
                    .timings
                    .get(name.as_str())
                    .ok_or("Missing prayer time")?;
                let parsed = DateTime::parse_from_rfc3339(raw).map_err(|e| e.to_string())?;
                let local = parsed.with_timezone(&city.timezone);
                if local.date_naive() != date || local.naive_local() != parsed.naive_local() {
                    return Err("Prayer time does not match its local date or UTC offset".into());
                }
                Ok(Occurrence {
                    name,
                    date,
                    time: local.format("%H:%M").to_string(),
                    instant: local.with_timezone(&Utc),
                })
            })
            .collect::<Result<Vec<_>, String>>()?;
        if days.insert(date, prayers).is_some() {
            return Err("Duplicate schedule date".into());
        }
    }
    Ok(days)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires the live city and prayer schedule services"]
    fn lille_search_and_two_month_calendar() {
        tauri::async_runtime::block_on(async {
            let client = client().unwrap();
            let cities = search(&client, "Lille", "en").await.unwrap();
            let french = cities
                .iter()
                .find(|city| city.country_code == "FR")
                .unwrap();
            let belgian = cities
                .iter()
                .find(|city| city.country_code == "BE")
                .unwrap();
            assert_ne!(french.id, belgian.id);
            let now = DateTime::parse_from_rfc3339("2026-10-24T12:00:00Z")
                .unwrap()
                .with_timezone(&Utc);
            let schedule = calendar(&client, french, now).await.unwrap();
            assert_eq!(schedule.prayers.len(), 14 * 5);
            assert_eq!(schedule.prayers[0].date.to_string(), "2026-10-24");
            assert_eq!(
                schedule.prayers.last().unwrap().date.to_string(),
                "2026-11-06"
            );
        });
    }
}
