use tauri::{Emitter, LogicalSize, Manager, PhysicalPosition, WebviewWindow};

#[tauri::command]
pub fn edge_layout(window: WebviewWindow, edge: String, mode: String) -> Result<(), String> {
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
        let (w, h) = match mode.as_str() {
            "alert" => (400, 98),
            "panel" if side => (270, 298),
            "panel" => (600, 150),
            _ if side => (8, 110),
            _ => (110, 8),
        };
        let w = (w as f64).min(area.size.width as f64 / scale);
        let h = (h as f64).min(area.size.height as f64 / scale);
        let dx = area.size.width as i32 - (w * scale).round() as i32;
        let dy = area.size.height as i32 - (h * scale).round() as i32;
        let (x, y) = match edge.as_str() {
            "left" => (0, dy / 2),
            "right" => (dx, dy / 2),
            "off" => (dx, dy),
            _ => (dx / 2, 0),
        };
        window.set_size(LogicalSize::new(w, h))?;
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

#[tauri::command]
pub fn edge_settings(app: tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.emit("open-settings", ())?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

