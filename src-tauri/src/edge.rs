use serde::{Deserialize, Serialize};
use std::{sync::Mutex, time::Duration};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Clone, Copy, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeMode {
    Hidden,
    Handle,
    Panel,
    Alert,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeAction {
    Open,
    Toggle,
    Settings,
    Close,
}

#[derive(Default)]
pub struct PendingAction(Mutex<Option<EdgeAction>>);

pub fn request_action(app: &AppHandle, action: EdgeAction) {
    let Some(window) = app.get_webview_window("edge") else {
        return;
    };
    *app.state::<PendingAction>()
        .0
        .lock()
        .expect("edge action lock") = Some(action);
    let _ = window.emit("edge-action", ());
}

#[tauri::command]
pub fn take_edge_action(action: tauri::State<'_, PendingAction>) -> Option<EdgeAction> {
    action.0.lock().expect("edge action lock").take()
}

#[derive(Clone, Copy)]
struct HoverRegion {
    origin: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    mode: EdgeMode,
}

impl HoverRegion {
    fn contains(self, cursor: PhysicalPosition<f64>) -> bool {
        let x = cursor.x - f64::from(self.origin.x);
        let y = cursor.y - f64::from(self.origin.y);
        (0.0..f64::from(self.size.width)).contains(&x)
            && (0.0..f64::from(self.size.height)).contains(&y)
    }
}

#[derive(Default)]
pub struct HoverTracker(Mutex<Option<HoverRegion>>);

#[derive(Clone, PartialEq, Serialize)]
struct HoverEvent {
    mode: EdgeMode,
    inside: bool,
}

pub fn start_hover_tracking(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Some(window) = app.get_webview_window("edge") else {
            return;
        };
        let mut previous = None;
        loop {
            let region = *app
                .state::<HoverTracker>()
                .0
                .lock()
                .expect("edge hover lock");
            let event = region.and_then(|region| {
                app.cursor_position().ok().map(|cursor| HoverEvent {
                    mode: region.mode,
                    inside: region.contains(cursor),
                })
            });
            if event != previous {
                if let Some(event) = &event {
                    let _ = window.emit("edge-hover", event);
                }
                previous = event;
            }
            tokio::time::sleep(Duration::from_millis(if region.is_some() {
                40
            } else {
                120
            }))
            .await;
        }
    });
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HoverSize {
    Small,
    Medium,
    Large,
}

impl HoverSize {
    fn length(self) -> u32 {
        match self {
            Self::Small => 110,
            Self::Medium => 180,
            Self::Large => 260,
        }
    }
}

fn trigger_size(
    side: bool,
    hover_size: HoverSize,
    thickness: u32,
    scale: f64,
) -> PhysicalSize<u32> {
    let length = (f64::from(hover_size.length()) * scale).round() as u32;
    let thickness = thickness.clamp(1, 12);
    if side {
        PhysicalSize::new(thickness, length)
    } else {
        PhysicalSize::new(length, thickness)
    }
}

#[cfg(windows)]
pub fn suppress_window_border(window: &WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::{DWMWA_BORDER_COLOR, DwmSetWindowAttribute};

    let Ok(handle) = window.hwnd() else { return };
    const DWM_COLOR_NONE: u32 = 0xFFFF_FFFE;
    // The CSS owns the shape. Windows 11 can otherwise add a non-client outline.
    unsafe {
        DwmSetWindowAttribute(
            handle.0,
            DWMWA_BORDER_COLOR as u32,
            (&DWM_COLOR_NONE as *const u32).cast(),
            size_of::<u32>() as u32,
        );
    }
}

#[tauri::command]
pub fn edge_layout(
    window: WebviewWindow,
    edge: String,
    mode: EdgeMode,
    hover_size: HoverSize,
    trigger_thickness: u32,
    interactive: bool,
) -> Result<(), String> {
    if window.label() != "edge" {
        return Err("Invalid window".into());
    }
    let layout = || -> tauri::Result<Option<HoverRegion>> {
        if mode == EdgeMode::Hidden {
            window.hide()?;
            return Ok(None);
        }
        let Some(monitor) = window.primary_monitor()? else {
            return Ok(None);
        };
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        let side = edge == "left" || edge == "right";
        let scaled = |width: f64, height: f64| {
            PhysicalSize::new(
                (width * scale).round() as u32,
                (height * scale).round() as u32,
            )
        };
        let size = match mode {
            EdgeMode::Alert => scaled(400.0, 98.0),
            EdgeMode::Panel if side => scaled(336.0, 408.0),
            EdgeMode::Panel => scaled(628.0, 300.0),
            _ => trigger_size(side, hover_size, trigger_thickness, scale),
        };
        let size = PhysicalSize::new(
            size.width.min(area.size.width),
            size.height.min(area.size.height),
        );
        let dx = (area.size.width - size.width) as i32;
        let dy = (area.size.height - size.height) as i32;
        let (x, y) = match edge.as_str() {
            "left" => (0, dy / 2),
            "right" => (dx, dy / 2),
            "off" => (dx, dy),
            _ => (dx / 2, 0),
        };
        window.set_size(size)?;
        let origin = PhysicalPosition::new(area.position.x + x, area.position.y + y);
        window.set_position(origin)?;
        window.set_focusable(interactive)?;
        if !window.is_visible()? {
            window.show()?;
        }
        if interactive && !window.is_focused()? {
            window.set_focus()?;
        }
        Ok(
            (!interactive && matches!(mode, EdgeMode::Handle | EdgeMode::Panel))
                .then_some(HoverRegion { origin, size, mode }),
        )
    };
    let tracker = window.state::<HoverTracker>();
    match layout() {
        Ok(region) => {
            *tracker.0.lock().expect("edge hover lock") = region;
            Ok(())
        }
        Err(error) => {
            *tracker.0.lock().expect("edge hover lock") = None;
            Err(error.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edge_trigger_keeps_physical_thickness_at_high_dpi() {
        assert_eq!(
            trigger_size(false, HoverSize::Small, 3, 1.5),
            PhysicalSize::new(165, 3)
        );
        assert_eq!(
            trigger_size(true, HoverSize::Large, 3, 1.5),
            PhysicalSize::new(3, 390)
        );
        assert_eq!(
            trigger_size(true, HoverSize::Medium, 20, 1.0),
            PhysicalSize::new(12, 180)
        );
    }

    #[test]
    fn large_hover_region_covers_transparent_space_next_to_the_handle() {
        let cursor = PhysicalPosition::new(-1920.0, 320.0);
        let region = |hover_size: HoverSize| {
            let size = trigger_size(true, hover_size, 3, 1.0);
            HoverRegion {
                origin: PhysicalPosition::new(-1920, 420 - size.height as i32 / 2),
                size,
                mode: EdgeMode::Handle,
            }
        };
        assert!(!region(HoverSize::Small).contains(cursor));
        assert!(region(HoverSize::Large).contains(cursor));
        assert!(!region(HoverSize::Large).contains(PhysicalPosition::new(-1917.0, 320.0)));
    }
}
