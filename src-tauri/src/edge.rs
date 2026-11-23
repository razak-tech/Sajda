use serde::Deserialize;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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
    mode: String,
    hover_size: HoverSize,
    trigger_thickness: u32,
) -> Result<(), String> {
    if window.label() != "edge" {
        return Err("Invalid window".into());
    }
    let layout = || -> tauri::Result<()> {
        if mode == "hidden" {
            return window.hide();
        }
        let Some(monitor) = window.primary_monitor()? else {
            return Ok(());
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
        let size = match mode.as_str() {
            "alert" => scaled(400.0, 98.0),
            "panel" if side => scaled(270.0, 298.0),
            "panel" => scaled(600.0, 150.0),
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
        window.set_position(PhysicalPosition::new(
            area.position.x + x,
            area.position.y + y,
        ))?;
        if !window.is_visible()? {
            window.show()?;
        }
        Ok(())
    };
    layout().map_err(|e| e.to_string())
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
}

#[tauri::command]
pub fn edge_settings(app: tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.emit("open-settings", ())?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}
