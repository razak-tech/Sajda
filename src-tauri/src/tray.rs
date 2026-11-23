use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Rect, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const TRAY_ID: &str = "sajda";

fn position(window: &WebviewWindow, rect: Rect) -> tauri::Result<()> {
    let scale = window.scale_factor()?;
    let anchor = rect.position.to_physical::<i32>(scale);
    let icon = rect.size.to_physical::<i32>(scale);
    let Some(monitor) = window.monitor_from_point(anchor.x.into(), anchor.y.into())? else {
        return window.center();
    };
    let area = monitor.work_area();
    let size = window.outer_size()?;
    let margin = (8.0 * monitor.scale_factor()).round() as i32;
    let width = size.width as i32;
    let height = size.height as i32;
    let right = area.position.x + area.size.width as i32;
    let bottom = area.position.y + area.size.height as i32;
    let x = (anchor.x + icon.width - width)
        .clamp(area.position.x, (right - width).max(area.position.x));
    let above = anchor.y - height - margin;
    let y = if above >= area.position.y {
        above
    } else {
        anchor.y + icon.height + margin
    }
    .clamp(area.position.y, (bottom - height).max(area.position.y));
    window.set_position(PhysicalPosition::new(x, y))
}

#[tauri::command]
pub fn dismiss(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fit_window(
    window: WebviewWindow,
    width: u32,
    height: u32,
    popup: bool,
) -> Result<(), String> {
    set_popup_mode(&window, popup);
    let resize = || -> tauri::Result<()> {
        let monitor = window.current_monitor()?;
        let height_limit = monitor.map_or(800, |monitor| {
            (monitor.work_area().size.height as f64 / monitor.scale_factor()) as u32
        });
        window.set_size(LogicalSize::new(
            width.clamp(320, 600),
            height.clamp(1, height_limit.max(1)),
        ))?;
        if popup {
            if let Some(rect) = window
                .app_handle()
                .tray_by_id(TRAY_ID)
                .and_then(|tray| tray.rect().ok().flatten())
            {
                position(&window, rect)?;
            }
        } else {
            window.center()?;
        }
        Ok(())
    };
    resize().map_err(|e| e.to_string())
}

pub fn set_menu(app: &AppHandle, arabic: bool) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu(app, arabic)?))?;
    }
    Ok(())
}

pub fn show_popup(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("open-popup", ());
        if let Some(rect) = app
            .tray_by_id(TRAY_ID)
            .and_then(|tray| tray.rect().ok().flatten())
        {
            let _ = position(&window, rect);
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn menu(app: &AppHandle, arabic: bool) -> tauri::Result<Menu<tauri::Wry>> {
    let settings = MenuItem::with_id(
        app,
        "settings",
        if arabic {
            "الإعدادات"
        } else {
            "Settings"
        },
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        if arabic { "خروج" } else { "Quit" },
        true,
        None::<&str>,
    )?;
    Menu::with_items(app, &[&settings, &quit])
}

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let window = app
        .get_webview_window("main")
        .expect("main window is configured");
    let shown_by_tray = app.state::<Arc<AtomicBool>>().inner().clone();
    let dismiss_on_blur = shown_by_tray.clone();
    let window_for_event = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = window_for_event.hide();
        }
        WindowEvent::Focused(false) if dismiss_on_blur.load(Ordering::Relaxed) => {
            let window = window_for_event.clone();
            let flag = dismiss_on_blur.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(160)).await;
                if flag.load(Ordering::Relaxed) && window.is_focused().ok() == Some(false) {
                    let _ = window.hide();
                }
            });
        }
        _ => {}
    });

    let settings_view = shown_by_tray.clone();
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(
            app.default_window_icon()
                .expect("app icon is configured")
                .clone(),
        )
        .tooltip("Sajda")
        .menu(&menu(app, false)?)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            "settings" => {
                settings_view.store(false, Ordering::Relaxed);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("open-settings", ());
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.emit("open-popup", ());
                        let _ = position(&window, rect);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

pub fn set_popup_mode(window: &WebviewWindow, popup: bool) {
    window
        .state::<Arc<AtomicBool>>()
        .store(popup, Ordering::Relaxed);
}
