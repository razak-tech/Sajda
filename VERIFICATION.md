# Sajda Windows release verification

Sajda 0.1.0 was built for Windows x64 with Tauri 2 and NSIS. The installer is at `src-tauri/target/release/bundle/nsis/Sajda_0.1.0_x64-setup.exe`.

SHA-256 `4B11FD6934377035CEC6FD0F53F67C67CEA9CBEBEEF33F4F20386B08794C72D9`

## Checks completed

| Area | Result |
| --- | --- |
| Build and installation | TypeScript and Vite built successfully. The Windows installer completed a clean installation and opened a native Sajda window. The temporary installation was removed after testing. |
| Figma and keyboard | Compared the English and Arabic popup, first-run city selection, and Settings against Figma. The English popup measured 360 × 297, Arabic popup 360 × 316, first-run city screen 400 × 375, and Settings 400 × 530. Verified local Figma assets, arrow-key city selection, language switching, and the countdown transition from Isha to the following Fajr. |
| Live schedule | The installed app distinguished Lille, France from Lille, Belgium and loaded 70 prayer times for Lille, France in Europe/Paris. A provider test also loaded a two-month range crossing the autumn daylight saving transition. |
| City replacement | Simulated a failed change to Paris in the frontend integration check. The application reported the failure and retained Lille as the current city. |
| Offline recovery | Restarted the installed app with an unreachable proxy scoped to the test process. The cached Lille schedule remained usable. A cache with no remaining coverage displayed the unavailable state and offered Retry. |
| Close and startup | The main window disappeared on Close while the process continued. Enabling and disabling Start with Windows added and removed the per-user Windows Run entry. Launching with `--autostart` kept the main window hidden. |
| Prayer reminder | With the installed main window hidden, a test prayer produced one persisted alert claim and one matching notification in Windows notification history. A Rust test verified deduplication after restart. |
| Clock and wake | Rust tests passed for skipping a crossed prayer after simulated suspend/resume or clock adjustments, daylight saving rollover, and normal prayer transitions. |

Sajda stores 14 days of AlAdhan prayer times. It uses AlAdhan’s default calculation method and Open-Meteo Geocoding for manual city lookup. Cached schedules refresh on launch and when stale or approaching the end of coverage. [AlAdhan Prayer Times API](https://aladhan.com/prayer-times-api) · [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)

Windows supplies the toast’s short sound and applies its notification and audio preferences. [Tauri Notifications](https://v2.tauri.app/plugin/notification/)

## Windows checks still pending

- Exercise the physical tray icon with a left click and the native Settings and Quit menu actions. The available desktop controls did not expose the Windows taskbar.
- Confirm launch behavior at an actual Windows sign-in with startup enabled and disabled.
- Hear the short notification sound on the target PC and test an actual suspend/resume across a scheduled prayer.

## Build and test commands

```powershell
npm ci
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --features custom-protocol -- --include-ignored
npm run tauri -- build --bundles nsis
```

The Rust suite passed six tests, including a live provider test that requires internet access.
