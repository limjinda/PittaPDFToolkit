import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export interface OpenedFile {
  path: string;
  name: string;
  bytes: number[]; // Tauri serializes Vec<u8> as number[]
}

/**
 * Open a native multi-select PDF file dialog.
 * Returns an array of { path, name, bytes } for each selected file,
 * or an empty array if the user cancels.
 */
export async function openPdfs(): Promise<OpenedFile[]> {
  const files = await invoke<OpenedFile[]>("open_pdfs");
  return files;
}

/**
 * Open a native save dialog and write the PDF bytes to disk.
 * Returns the saved path, or null if the user cancels.
 */
export async function savePdf(
  defaultName: string,
  bytes: Uint8Array
): Promise<string | null> {
  const path = await save({
    title: "Save PDF as",
    defaultPath: defaultName,
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
  });
  if (path) {
    await writeFile(path, bytes);
  }
  return path;
}

let cachedFontBytes: Uint8Array | null = null;

/**
 * Loads Sarabun-Regular.ttf font bytes from the public directory.
 * Caches the result in memory for subsequent saves.
 */
export async function getSystemFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    const response = await fetch("/fonts/Sarabun-Regular.ttf");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    cachedFontBytes = new Uint8Array(arrayBuffer);
    return cachedFontBytes;
  } catch (error) {
    console.error("Failed to load Sarabun font:", error);
    return null;
  }
}
