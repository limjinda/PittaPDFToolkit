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



/// Finds a writable directory whose path contains only ASCII characters.
fn get_ascii_temp_dir() -> std::path::PathBuf {
    if let Ok(t) = std::env::var("TEMP") {
        if t.chars().all(|c| c.is_ascii()) {
            return std::path::PathBuf::from(t);
        }
    }
    if let Ok(t) = std::env::var("TMP") {
        if t.chars().all(|c| c.is_ascii()) {
            return std::path::PathBuf::from(t);
        }
    }
    // Fallback to current directory or C:\Temp
    let c_temp = std::path::PathBuf::from("C:\\Temp");
    if c_temp.exists() {
        return c_temp;
    }
    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
}

#[command]
async fn compress_pdf(app: tauri::AppHandle, input_path: String, output_path: String, quality: String) -> Result<(), String> {
    use tauri::Manager;
    let temp_dir = get_ascii_temp_dir();
    let temp_name_in = format!("temp_compress_in_{}.pdf", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let temp_name_out = format!("temp_compress_out_{}.pdf", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    
    let temp_in = temp_dir.join(temp_name_in);
    let temp_out = temp_dir.join(temp_name_out);

    // Copy the original input file (which may have Thai/Unicode characters in its path)
    // to an ASCII-only temporary path so Ghostscript can read it without encoding errors.
    if let Err(e) = std::fs::copy(&input_path, &temp_in) {
        return Err(format!("Failed to copy input PDF to temp ASCII path: {}", e));
    }

    // Resolve bundled Ghostscript
    let gs = app.path().resolve("resources/gs/windows/gswin64c.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_in);
            format!("Could not resolve GS path: {}", e)
        })?;

    let mut last_error = String::new();
    let mut executed = false;

    let mut cmd = std::process::Command::new(&gs);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let mut gs_args: Vec<String> = vec![
        "-sDEVICE=pdfwrite".to_string(),
        "-dCompatibilityLevel=1.4".to_string(),
        "-dNOPAUSE".to_string(),
        "-dQUIET".to_string(),
        "-dBATCH".to_string(),
        format!("-sOutputFile={}", temp_out.to_string_lossy()),
    ];

    if quality.as_str() == "max" {
        // Custom extreme compression, balanced for readability on scanned documents
        gs_args.push("-dPDFSETTINGS=/ebook".to_string()); // Base optimizations (better JPEG quality than /screen)
        gs_args.push("-dColorImageResolution=144".to_string());
        gs_args.push("-dGrayImageResolution=144".to_string());
        gs_args.push("-dMonoImageResolution=144".to_string());
        gs_args.push("-dColorImageDownsampleThreshold=1.0".to_string());
        gs_args.push("-dGrayImageDownsampleThreshold=1.0".to_string());
        gs_args.push("-dMonoImageDownsampleThreshold=1.0".to_string());
        gs_args.push("-dEmbedAllFonts=false".to_string());
        gs_args.push("-dSubsetFonts=false".to_string());
        gs_args.push("-dDEVICEWIDTHPOINTS=595".to_string());
        gs_args.push("-dDEVICEHEIGHTPOINTS=842".to_string());
        gs_args.push("-dFIXEDMEDIA=true".to_string());
        gs_args.push("-dPDFFitPage=true".to_string());
        gs_args.push("-dCompressPages=true".to_string());
        gs_args.push("-dUseFlateCompression=true".to_string());
        gs_args.push("-dDetectDuplicateImages=true".to_string());
    } else {
        // Default presets
        let gs_preset = match quality.as_str() {
            "lossless" => "/prepress", // High quality
            "balanced" => "/ebook",    // Medium quality
            _ => "/ebook",
        };
        gs_args.push(format!("-dPDFSETTINGS={}", gs_preset));
    }

    gs_args.push(temp_in.to_string_lossy().to_string());

    let result = cmd.args(&gs_args).output();

    match result {
        Ok(out) => {
            if out.status.success() {
                executed = true;
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                last_error = format!("Stdout: {}\nStderr: {}", stdout, stderr);
            }
        }
        Err(e) => {
            last_error = e.to_string();
        }
    }

    if executed {
        if let Err(e) = std::fs::copy(&temp_out, &output_path) {
            let _ = std::fs::remove_file(&temp_out);
            let _ = std::fs::remove_file(&temp_in);
            return Err(format!("Failed to copy compressed PDF to target: {}", e));
        }
        let _ = std::fs::remove_file(&temp_out);
        let _ = std::fs::remove_file(&temp_in);
        Ok(())
    } else {
        let _ = std::fs::remove_file(&temp_out);
        let _ = std::fs::remove_file(&temp_in);
        Err(format!("Ghostscript compression failed. Path: {:?}. Last error: {}", gs, last_error))
    }
}

#[command]
async fn encrypt_pdf(app: tauri::AppHandle, input_path: String, output_path: String, user_pass: String, owner_pass: String) -> Result<(), String> {
    use tauri::Manager;
    let temp_dir = get_ascii_temp_dir();
    let temp_name_in = format!("temp_encrypt_in_{}.pdf", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let temp_name_out = format!("temp_encrypt_out_{}.pdf", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let temp_in = temp_dir.join(temp_name_in);
    let temp_out = temp_dir.join(temp_name_out);

    if let Err(e) = std::fs::copy(&input_path, &temp_in) {
        return Err(format!("Failed to copy input PDF to temp ASCII path: {}", e));
    }

    let gs = app.path().resolve("resources/gs/windows/gswin64c.exe", tauri::path::BaseDirectory::Resource)
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_in);
            format!("Could not resolve GS path: {}", e)
        })?;

    let mut last_error = String::new();
    let mut executed = false;

    let mut cmd = std::process::Command::new(&gs);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.args(&[
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
    ]);

    if !owner_pass.is_empty() {
        cmd.arg(format!("-sOwnerPassword={}", owner_pass));
    } else if !user_pass.is_empty() {
        cmd.arg(format!("-sOwnerPassword={}", user_pass));
    }

    if !user_pass.is_empty() {
        cmd.arg(format!("-sUserPassword={}", user_pass));
    }
    
    cmd.arg("-dEncryptionR=3");
    cmd.arg("-dKeyLength=128");

    cmd.arg(format!("-sOutputFile={}", temp_out.to_string_lossy()));
    cmd.arg(&temp_in.to_string_lossy().to_string());

    match cmd.output() {
        Ok(out) => {
            if out.status.success() {
                executed = true;
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                last_error = format!("Stdout: {}\nStderr: {}", stdout, stderr);
            }
        }
        Err(e) => {
            last_error = e.to_string();
        }
    }

    if executed {
        if let Err(e) = std::fs::copy(&temp_out, &output_path) {
            let _ = std::fs::remove_file(&temp_out);
            let _ = std::fs::remove_file(&temp_in);
            return Err(format!("Failed to copy encrypted PDF to target: {}", e));
        }
        let _ = std::fs::remove_file(&temp_out);
        let _ = std::fs::remove_file(&temp_in);
        Ok(())
    } else {
        let _ = std::fs::remove_file(&temp_out);
        let _ = std::fs::remove_file(&temp_in);
        Err(format!("Ghostscript encryption failed. Path: {:?}. Last error: {}", gs, last_error))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_pdfs,
            save_pdf,
            read_pdf_by_path,
            read_system_font,
            compress_pdf,
            encrypt_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
