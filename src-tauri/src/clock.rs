use chrono::{DateTime, Utc};
use std::{
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::{Duration, Instant},
};

static SUSPENDED: AtomicBool = AtomicBool::new(false);
static GENERATION: AtomicU64 = AtomicU64::new(0);

pub struct Reading {
    pub utc: DateTime<Utc>,
    monotonic: Instant,
    suspended: bool,
    generation: u64,
}

impl Reading {
    pub fn now() -> Self {
        Self {
            utc: Utc::now(),
            monotonic: Instant::now(),
            suspended: SUSPENDED.load(Ordering::SeqCst),
            generation: GENERATION.load(Ordering::SeqCst),
        }
    }

    pub fn changed_since(&self, previous: &Self) -> bool {
        let elapsed = self.monotonic.saturating_duration_since(previous.monotonic);
        let wall_elapsed = self.utc - previous.utc;
        self.generation != previous.generation
            || wall_elapsed.num_milliseconds() < 0
            || (wall_elapsed.num_milliseconds() as i128 - elapsed.as_millis() as i128).abs() > 1_000
    }

    pub fn may_dispatch(&self, previous: &Self) -> bool {
        !self.suspended
            && !previous.suspended
            && !self.changed_since(previous)
            && self.monotonic.saturating_duration_since(previous.monotonic)
                <= Duration::from_secs(5)
    }

    pub fn should_refresh(&self, previous: &Self) -> bool {
        !self.suspended && (previous.suspended || self.changed_since(previous))
    }
}

#[cfg(windows)]
pub fn install(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMESUSPEND, PBT_APMSUSPEND, WM_NCDESTROY,
                WM_POWERBROADCAST, WM_TIMECHANGE,
            },
        },
    };

    unsafe extern "system" fn on_message(
        handle: HWND,
        message: u32,
        param: WPARAM,
        data: LPARAM,
        id: usize,
        _context: usize,
    ) -> LRESULT {
        match message {
            WM_POWERBROADCAST => match param as u32 {
                PBT_APMSUSPEND => {
                    SUSPENDED.store(true, Ordering::SeqCst);
                    GENERATION.fetch_add(1, Ordering::SeqCst);
                }
                PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMESUSPEND => {
                    if SUSPENDED.swap(false, Ordering::SeqCst)
                        || param as u32 == PBT_APMRESUMEAUTOMATIC
                    {
                        GENERATION.fetch_add(1, Ordering::SeqCst);
                    }
                }
                _ => {}
            },
            WM_TIMECHANGE => {
                GENERATION.fetch_add(1, Ordering::SeqCst);
            }
            WM_NCDESTROY => {
                // The callback is installed on this UI thread and removed with its window.
                unsafe { RemoveWindowSubclass(handle, Some(on_message), id) };
            }
            _ => {}
        }
        unsafe { DefSubclassProc(handle, message, param, data) }
    }

    let handle = window.hwnd()?.0;
    // Tauri invokes setup on the window thread and the callback has a static lifetime.
    if unsafe { SetWindowSubclass(handle, Some(on_message), 1, 0) } == 0 {
        return Err(std::io::Error::other("Could not register Windows clock notifications").into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resume_and_manual_clock_changes_skip_past_prayers() {
        let start = Reading::now();
        let awake = Reading {
            utc: start.utc + chrono::Duration::milliseconds(250),
            monotonic: start.monotonic + Duration::from_millis(250),
            suspended: false,
            generation: start.generation,
        };
        assert!(awake.may_dispatch(&start));

        let resumed = Reading {
            generation: start.generation + 2,
            ..awake
        };
        assert!(!resumed.may_dispatch(&start));
        assert!(resumed.should_refresh(&start));

        let adjusted = Reading {
            utc: start.utc + chrono::Duration::hours(1),
            ..awake
        };
        assert!(!adjusted.may_dispatch(&start));
        assert!(adjusted.should_refresh(&start));

        let backward = Reading {
            utc: start.utc - chrono::Duration::minutes(3),
            ..awake
        };
        assert!(!backward.may_dispatch(&start));
    }
}
