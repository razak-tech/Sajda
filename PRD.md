# Sajda Product Requirements Document

**Status** · Draft  
**Target** · Windows desktop  
**Stack** · Tauri 2, React, TypeScript, and Rust

## Product goal

Sajda is a Windows system tray app for Muslims who want to see the next daily prayer and how much time remains. A single click on the tray icon opens a compact window with the prayer name, its scheduled time, and a live countdown. At prayer time, Sajda shows a visual notification and plays a short sound.

## First-run experience

1. The user manually selects their city and country. Show the country or region alongside each city so users can distinguish places with the same name.
2. Ask whether Sajda should start automatically when the user signs in to Windows. The user can change this preference in Settings.
3. Fetch the prayer schedule using the provider's default calculation method. Show the countdown as soon as a usable schedule is available. If the initial fetch fails, explain that a connection is needed to download the schedule and offer a retry.

## MVP requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| R1 | Tray access | While Sajda is running, one click on its tray icon opens the compact window. Closing the window returns the app to the tray and reminders continue. The tray menu provides Settings and Quit. |
| R2 | Next prayer and countdown | The window shows the selected city, next prayer, scheduled local time for that city, and live time remaining. It covers Fajr, Dhuhr, Asr, Maghrib, and Isha. After Isha, it advances to the following day's Fajr when that schedule is available. |
| R3 | Prayer-time alerts | While the app is running and the PC is awake, each scheduled prayer triggers one visual Windows notification and one short sound, including when the window is closed. Respect Windows notification and audio settings. |
| R4 | Manual city selection | Users can change their city in Settings. Refresh the schedule for the new city and keep the city label, countdown, and alert schedule consistent. If the change cannot be completed, keep the previous selection active and show an error. |
| R5 | Offline schedule | Cache several days for the selected city on disk, including tomorrow's schedule when available. Reuse valid cached times after a restart or failed refresh. If the cache cannot identify the next prayer, show that the schedule is unavailable and let the user retry. |
| R6 | Sleep and wake | On wake, recompute the countdown from the current time and resume scheduling future alerts. Skip prayers that became due during sleep. |
| R7 | Start with Windows | Save the user's first-run choice. When enabled, launch Sajda into the tray at Windows sign-in. Settings reflects the current preference. |

## Schedule and reliability

- Use the selected city's time zone to interpret provider times, including daylight saving changes. Compute the countdown from the current clock and the scheduled instant so it stays accurate across midnight and after sleep.
- Store the city, time zone, schedule dates, and fetch time with the cache. Refresh on startup when needed and before valid coverage runs out. Keep usable cached data if a refresh fails or returns invalid data.
- Deduplicate alerts by city, local date, and prayer. Rebuild pending alerts after a city change, clock change, or resume.
- Keep preferences and schedule data local. Send only the location information required to look up the city and fetch prayer times. Manual selection is the location workflow.

## Technical responsibilities

| Layer | Responsibility |
| --- | --- |
| Tauri 2 | Windows desktop shell, tray lifecycle, native integration, and packaging. |
| React and TypeScript | Compact countdown window, first-run setup, Settings, and loading and error states. |
| Rust | Provider access, time-zone handling, schedule validation, local persistence, and background reminders. |
| Tauri commands and events | Expose settings and schedule state to the UI. Send updates when the active prayer, city, or schedule changes. |

## Release plan and verification

1. Build the tray shell, setup flow, and Settings. Verify one-click access, closing to tray, Quit, and both startup choices on Windows.
2. Connect the prayer-time provider, implement caching, and display the countdown. Verify an online first run, offline restart, expired cache, city change, and Isha-to-Fajr rollover.
3. Add alerts and wake handling. Verify one visual alert and one short sound per prayer with the window closed, then suspend across a prayer and verify the countdown updates without a missed alert upon wake.
4. Package a Windows build and repeat the core flows from a clean install, including startup at sign-in and operation with internet access disabled after a successful sync.

## Open decisions

- **Prayer-time provider.** Choose an API that supplies the necessary city, time-zone, and multi-day schedule data using its default calculation method.
- **Cache duration.** Set the exact number of days after selecting a provider and checking its schedule coverage and request limits.

## Later releases

Prayer tracking is deferred until after the MVP.
