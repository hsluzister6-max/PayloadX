//! Right-click the PayloadX dock icon → New Window (macOS).
#![allow(unexpected_cfgs, clippy::missing_transmute_annotations)]

use cocoa::appkit::{NSApp, NSMenu, NSMenuItem};
use cocoa::base::{id, nil};
use cocoa::foundation::NSString;
use objc::runtime::{Class, Object, Sel, BOOL, Imp};
use objc::{msg_send, sel, sel_impl};
use std::ffi::c_char;
use std::sync::OnceLock;
use tauri::AppHandle;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static DOCK_MENU: OnceLock<usize> = OnceLock::new();

#[link(name = "objc")]
extern "C" {
    fn class_addMethod(cls: *const Class, name: Sel, imp: Imp, types: *const c_char) -> BOOL;
    fn class_replaceMethod(cls: *const Class, name: Sel, imp: Imp, types: *const c_char) -> Imp;
}

extern "C" fn application_dock_menu(_this: &Object, _cmd: Sel, _sender: id) -> id {
    DOCK_MENU.get().map(|ptr| *ptr as id).unwrap_or(nil)
}

extern "C" fn payloadx_new_window(_this: &Object, _cmd: Sel, _sender: id) {
    if let Some(app) = APP_HANDLE.get() {
        let app = app.clone();
        let _ = app.clone().run_on_main_thread(move || {
            let _ = crate::commands::window::open_workspace_window(&app, None, None);
        });
    }
}

fn add_method(cls: *const Class, name: Sel, imp: Imp, types: &str) {
    unsafe {
        let types_ptr = types.as_ptr() as *const c_char;
        if !class_addMethod(cls, name, imp, types_ptr) {
            let _ = class_replaceMethod(cls, name, imp, types_ptr);
        }
    }
}

pub fn install(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());

    unsafe {
        let ns_app = NSApp();
        let delegate: id = msg_send![ns_app, delegate];
        if delegate == nil {
            return;
        }

        let cls: *const Class = msg_send![delegate, class];

        add_method(
            cls,
            sel!(applicationDockMenu:),
            std::mem::transmute::<
                extern "C" fn(&Object, Sel, id) -> id,
                Imp,
            >(application_dock_menu),
            "@@:@\0",
        );
        add_method(
            cls,
            sel!(payloadxNewWindow:),
            std::mem::transmute::<extern "C" fn(&Object, Sel, id), Imp>(payloadx_new_window),
            "v@:@\0",
        );

        let menu = NSMenu::alloc(nil).initWithTitle_(NSString::alloc(nil).init_str(""));
        let item = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
            NSString::alloc(nil).init_str("New Window"),
            sel!(payloadxNewWindow:),
            NSString::alloc(nil).init_str(""),
        );
        let _: () = msg_send![item, setTarget: delegate];
        menu.addItem_(item);

        let _ = DOCK_MENU.set(menu as usize);
    }
}
