use tauri::command;
use std::fs;

/// Opens a native multi-select PDF file dialog and returns
/// the paths and raw bytes for each selected file.
#[derive(serde::Serialize)]
pub struct OpenedFile {
    pub path: String,
    pub name: String,
    pub bytes: Vec<u8>,
}

#[command]
async fn open_pdfs(app: tauri::AppHandle) -> Result<Vec<OpenedFile>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_paths = app
        .dialog()
        .file()
        .set_title("Open PDF files")
        .add_filter("PDF Files", &["pdf"])
        .blocking_pick_files();

    match file_paths {
        Some(paths) => {
            let mut files = Vec::new();
            for file_path in paths {
                let path_str = file_path.to_string();
                let bytes = fs::read(&path_str)
                    .map_err(|e| format!("Failed to read {}: {}", path_str, e))?;
                let name = std::path::Path::new(&path_str)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown.pdf")
                    .to_string();
                files.push(OpenedFile {
                    path: path_str,
                    name,
                    bytes,
                });
            }
            Ok(files)
        }
        None => Ok(vec![]), // user cancelled
    }
}

/// Reads a single PDF file from an absolute path and returns its bytes.
/// Used for files obtained via Tauri's native drag-drop events,
/// where we receive real OS paths rather than browser File objects.
#[command]
async fn read_pdf_by_path(path: String) -> Result<OpenedFile, String> {
    let bytes = fs::read(&path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.pdf")
        .to_string();
    Ok(OpenedFile { path, name, bytes })
}

/// Opens a native save dialog and writes bytes to the chosen path.
#[command]
async fn save_pdf(app: tauri::AppHandle, default_name: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let save_path = app
        .dialog()
        .file()
        .set_title("Save PDF as")
        .set_file_name(&default_name)
        .add_filter("PDF Files", &["pdf"])
        .blocking_save_file();

    match save_path {
        Some(path) => {
            let path_str = path.to_string();
            fs::write(&path_str, &bytes)
                .map_err(|e| format!("Failed to write PDF: {}", e))?;
            Ok(Some(path_str))
        }
        None => Ok(None), // user cancelled
    }
}

/// Reads the compile-time embedded Sarabun-Regular font that supports Thai/Unicode characters
/// and returns its raw bytes.
#[command]
async fn read_system_font() -> Result<Vec<u8>, String> {
    let font_bytes = include_bytes!("../fonts/Sarabun-Regular.ttf");
    Ok(font_bytes.to_vec())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_pdfs,
            save_pdf,
            read_pdf_by_path,
            read_system_font
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
