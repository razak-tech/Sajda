# Sajda Windows release verification

## Windows x64 build for 0.1.0

The installer is at `src-tauri/target/release/bundle/nsis/Sajda_0.1.0_x64-setup.exe`.

SHA-256 `2984CE4DCC107F83FF51982DD9C55EC0847ABC474305F3E2D01114B390A3B09A`

The production frontend build, seven local Rust tests, and the live Open-Meteo and AlAdhan test passed. The NSIS archive passed its integrity check and contained the Windows x64 executable from the release build, with Tauri's NSIS bundle marker applied. This installer is unsigned. A clean installation and manual checks on this exact package are pending.

## Checks completed on an earlier build

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

The current build plays the selected reminder sound and shows a card in the edge window. A Windows notification is the fallback when the edge window is unavailable or the event fails to emit.

## Windows checks still pending

- Exercise the physical tray icon with a left click and the native Settings and Quit menu actions. The available desktop controls did not expose the Windows taskbar.
- Confirm launch behavior at an actual Windows sign-in with startup enabled and disabled.
- Hear the selected reminder sound on the target PC and test an actual suspend/resume across a scheduled prayer.

## Build and test commands

```powershell
npm ci
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --features custom-protocol -- --include-ignored
.\node_modules\.bin\tauri.cmd build --bundles nsis --ci
```

The live provider test requires internet access.
