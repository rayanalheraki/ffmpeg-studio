//! File system helpers for the webview. Every path must be absolute.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const SETTINGS_FILE: &str = "settings.json";

fn absolute(path: &str) -> Result<&Path, String> {
    let path = Path::new(path);
    if path.is_absolute() {
        Ok(path)
    } else {
        Err("File paths must be absolute.".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathInfo {
    is_file: bool,
    is_dir: bool,
    size: u64,
    modified_ms: f64,
}

/// Returns null when the path does not exist or cannot be read.
#[tauri::command]
pub fn path_info(path: String) -> Result<Option<PathInfo>, String> {
    let Ok(meta) = fs::metadata(absolute(&path)?) else { return Ok(None) };
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0.0, |duration| duration.as_secs_f64() * 1000.0);
    Ok(Some(PathInfo { is_file: meta.is_file(), is_dir: meta.is_dir(), size: meta.len(), modified_ms }))
}

#[tauri::command]
pub fn create_dir_all(path: String) -> Result<(), String> {
    fs::create_dir_all(absolute(&path)?).map_err(|e| e.to_string())
}

/// Removes a file; a file that is already gone is not an error.
#[tauri::command]
pub fn remove_file(path: String) -> Result<(), String> {
    match fs::remove_file(absolute(&path)?) {
        Err(error) if error.kind() != ErrorKind::NotFound => Err(error.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn reveal_path(app: AppHandle, path: String) -> Result<(), String> {
    app.opener().reveal_item_in_dir(absolute(&path)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    let path = absolute(&path)?.to_string_lossy().into_owned();
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join(SETTINGS_FILE))
}

/// The raw settings JSON, or null on first launch. The webview sanitizes it.
#[tauri::command]
pub fn read_settings(app: AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(settings_path(&app)?) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

/// Writes through a temporary file so a crash never leaves half-written settings.
#[tauri::command]
pub fn write_settings(app: AppHandle, contents: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, contents).map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    platform: &'static str,
    windows_dir: Option<String>,
}

#[tauri::command]
pub fn host_info() -> HostInfo {
    let platform = match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        "linux" => "linux",
        _ => "other",
    };
    HostInfo { platform, windows_dir: std::env::var("WINDIR").ok() }
}
