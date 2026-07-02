import { invoke } from "@tauri-apps/api/core";

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
  const result = await invoke<string | null>("save_pdf", {
    defaultName,
    bytes: Array.from(bytes),
  });
  return result;
}
