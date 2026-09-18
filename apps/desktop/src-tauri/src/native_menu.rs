use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

pub const NEW_WINDOW_MENU_ID: &str = "new_window";

pub fn native_menu() -> Menu {
    let new_window = CustomMenuItem::new(NEW_WINDOW_MENU_ID, "New Window")
        .accelerator("CmdOrCtrl+Shift+N");

    #[cfg(target_os = "macos")]
    let file = Submenu::new(
        "File",
        Menu::new()
            .add_item(new_window)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow),
    );

    #[cfg(not(target_os = "macos"))]
    let file = Submenu::new(
        "File",
        Menu::new()
            .add_item(new_window)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow)
            .add_native_item(MenuItem::Quit),
    );

    #[cfg(target_os = "macos")]
    {
        Menu::new()
            .add_submenu(Submenu::new(
                "PayloadX",
                Menu::new()
                    .add_native_item(MenuItem::About(
                        "PayloadX".into(),
                        tauri::AboutMetadata::default(),
                    ))
                    .add_native_item(MenuItem::Separator)
                    .add_native_item(MenuItem::Services)
                    .add_native_item(MenuItem::Separator)
                    .add_native_item(MenuItem::Hide)
                    .add_native_item(MenuItem::HideOthers)
                    .add_native_item(MenuItem::ShowAll)
                    .add_native_item(MenuItem::Separator)
                    .add_native_item(MenuItem::Quit),
            ))
            .add_submenu(file)
            .add_submenu(Submenu::new(
                "Edit",
                Menu::new()
                    .add_native_item(MenuItem::Undo)
                    .add_native_item(MenuItem::Redo)
                    .add_native_item(MenuItem::Separator)
                    .add_native_item(MenuItem::Cut)
                    .add_native_item(MenuItem::Copy)
                    .add_native_item(MenuItem::Paste)
                    .add_native_item(MenuItem::SelectAll),
            ))
            .add_submenu(Submenu::new(
                "Window",
                Menu::new()
                    .add_native_item(MenuItem::Minimize)
                    .add_native_item(MenuItem::Zoom)
                    .add_native_item(MenuItem::Separator)
                    .add_native_item(MenuItem::EnterFullScreen),
            ))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Menu::new().add_submenu(file)
    }
}
