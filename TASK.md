# Sajda Development Tasks

The product requirements are in [PRD.md](PRD.md). Work through the main milestones in order. Codex owns the implementation and verification steps. Abdou reviews the checkpoints listed for each milestone.

See [Windows release verification](VERIFICATION.md) for the installer, results, and remaining Windows checks.

## Progress

- [x] M1. Desktop foundation
- [ ] M2. Windows tray
- [x] M3. Prayer countdown
- [x] M4. Live prayer times
- [x] M5. Offline schedules
- [ ] M6. Start with Windows
- [ ] M7. Prayer reminders
- [ ] M8. Sleep and clock changes
- [ ] M9. Windows release

## M1. Desktop foundation

**Codex tasks**

- [x] M1.1 Scaffold the Windows app with Tauri 2, React, TypeScript, and Rust.
- [x] M1.2 Install project dependencies and verify the frontend build.
- [x] M1.3 Compile the Rust backend and launch the native Sajda window.

**Abdou’s role** · Review the first runnable build.

**Done when** · Sajda builds and a native window opens on Windows.

## M2. Windows tray

**Codex tasks**

- [x] M2.1 Add the Windows tray icon and open the popup on one click.
- [x] M2.2 Hide the popup when closed and keep Sajda running.
- [ ] M2.3 Add Settings and Quit to the tray menu. Verify all tray actions.

**Abdou’s role** · Try opening and closing the popup.

**Done when** · Closing keeps Sajda running and Quit exits.

## M3. Prayer countdown

**Codex tasks**

- [x] M3.1 Create sample schedules for all five prayers and tomorrow’s Fajr.
- [x] M3.2 Use the city’s time zone to select the next prayer and compute the countdown.
- [x] M3.3 Display the city, prayer name, scheduled time, and live countdown.
- [x] M3.4 Verify prayer transitions, including the rollover from Isha to Fajr.

**Abdou’s role** · Review the popup against the two design references and give feedback.

**Done when** · The city, next prayer, scheduled time, and countdown are correct.

## M4. Live prayer times

**Codex tasks**

- [x] M4.1 Evaluate and select a provider that supplies city, time-zone, and schedule data.
- [x] M4.2 Fetch and validate prayer times using the provider’s default calculation method.
- [x] M4.3 Add manual city selection to setup and Settings.
- [x] M4.4 Handle loading, errors, and Retry. Preserve the previous schedule if a city change fails.

**Abdou’s role** · Review sample prayer times for Lille or another familiar city.

**Done when** · A selected city loads live times and a failed city change preserves the previous schedule.

## M5. Offline schedules

**Codex tasks**

- [x] M5.1 Set the cache duration based on provider coverage.
- [x] M5.2 Persist multiple days of schedules with city and time-zone metadata.
- [x] M5.3 Refresh before coverage expires and retain valid data on refresh failure.
- [x] M5.4 Verify offline restart, missing coverage, and Retry.

**Abdou’s role** · Review the offline and recovery messages.

**Done when** · Cached times work after an offline restart and missing coverage offers Retry.

## M6. Start with Windows

**Codex tasks**

- [x] M6.1 Ask about starting with Windows during first-run setup.
- [x] M6.2 Save the preference and let the user change it in Settings.
- [ ] M6.3 Verify Windows sign-in with the preference both enabled and disabled.

**Abdou’s role** · Review the wording of the startup choice.

**Done when** · The saved preference controls whether Sajda launches into the tray at sign-in.

## M7. Prayer reminders

**Codex tasks**

- [x] M7.1 Schedule a Windows notification and a short sound for each prayer.
- [x] M7.2 Prevent duplicate alerts and reschedule pending alerts after a city change.
- [ ] M7.3 Trigger a test prayer with the popup closed and verify both alerts.

**Abdou’s role** · Review the alert sound and notification wording.

**Done when** · A test prayer triggers one notification and one sound with the popup closed.

## M8. Sleep and clock changes

**Codex tasks**

- [x] M8.1 Recompute the countdown and future reminders using the current clock after wake.
- [x] M8.2 Skip reminders for prayers that occurred during sleep.
- [ ] M8.3 Verify wake, manual clock changes, midnight, and daylight saving transitions.

**Abdou’s role** · Review the Windows verification results.

**Done when** · Waking updates the countdown and schedules the next alert without replaying a missed one.

## M9. Windows release

**Codex tasks**

- [x] M9.1 Build the Windows installer.
- [ ] M9.2 Run the PRD acceptance checks from a clean installation.
- [x] M9.3 Record the results and any checks blocked by the environment.

**Abdou’s role** · Try the release candidate and decide whether to release it.

**Done when** · The installed build passes the MVP acceptance criteria.
