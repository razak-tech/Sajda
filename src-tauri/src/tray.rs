use crate::edge::{EdgeAction, request_action};
use tauri::{
    AppHandle, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const TRAY_ID: &str = "sajda";

pub fn set_menu(app: &AppHandle, arabic: bool) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu(app, arabic)?))?;
    }
    Ok(())
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
        .get_webview_window("edge")
        .expect("edge window is configured");
    let window_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            request_action(&window_app, EdgeAction::Close);
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
            "settings" => request_action(app, EdgeAction::Settings),
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                request_action(tray.app_handle(), EdgeAction::Toggle);
            }
        })
        .build(app)?;
    Ok(())
}
