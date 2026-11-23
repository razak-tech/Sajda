use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const TRAY_ID: &str = "sajda";

#[tauri::command]
pub fn dismiss(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fit_window(window: WebviewWindow, height: u32) -> Result<(), String> {
    let resize = || -> tauri::Result<()> {
        let monitor = window.current_monitor()?;
        let (width, height_limit) = monitor.map_or((720, 800), |monitor| {
            let area = monitor.work_area();
            let scale = monitor.scale_factor();
            (
                (area.size.width as f64 / scale) as u32,
                (area.size.height as f64 / scale) as u32,
            )
        });
        window.set_size(LogicalSize::new(
            width.min(720),
            height.clamp(1, height_limit.max(1)),
        ))
    };
    resize().map_err(|error| error.to_string())
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
    let window_for_event = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_for_event.hide();
        }
    });
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
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.emit("open-popup", ());
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}
