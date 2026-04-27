use std::fs;
use std::path::PathBuf;
use tauri::api::path::app_data_dir;

fn get_storage_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config = app_handle.config();
    let base = app_data_dir(&config).ok_or("Could not resolve app data directory")?;
    let dir = base.join("payloadx");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

fn sanitize_filename(filename: &str) -> Result<(), String> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename: path traversal not allowed".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn save_local_file(
    app_handle: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    sanitize_filename(&filename)?;
    let dir = get_storage_dir(&app_handle)?;
    let filepath = dir.join(&filename);
    fs::write(&filepath, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_local_file(
    app_handle: tauri::AppHandle,
    filename: String,
) -> Result<String, String> {
    sanitize_filename(&filename)?;
    let dir = get_storage_dir(&app_handle)?;
    let filepath = dir.join(&filename);
    if !filepath.exists() {
        return Err(format!("File not found: {}", filename));
    }
    fs::read_to_string(&filepath).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_local_files(
    app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let dir = get_storage_dir(&app_handle)?;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let files: Vec<String> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            Some(entry.file_name().to_string_lossy().to_string())
        })
        .collect();
    Ok(files)
}
