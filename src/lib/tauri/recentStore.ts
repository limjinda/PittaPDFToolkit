import { load } from "@tauri-apps/plugin-store";

export interface RecentFile {
  path: string;
  name: string;
  pageCount: number;
  lastOpened: number; // Unix timestamp ms
}

const STORE_KEY = "recent_files";
const MAX_RECENT = 10;

async function getStore() {
  return load("pdf-toolbox.json", { defaults: {}, autoSave: true });
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  try {
    const store = await getStore();
    const files = await store.get<RecentFile[]>(STORE_KEY);
    return files ?? [];
  } catch {
    return [];
  }
}

export async function addRecentFile(file: RecentFile): Promise<void> {
  try {
    const store = await getStore();
    const existing = (await store.get<RecentFile[]>(STORE_KEY)) ?? [];

    // Remove duplicate path
    const filtered = existing.filter((f) => f.path !== file.path);

    // Add to front, cap at MAX_RECENT
    const updated = [file, ...filtered].slice(0, MAX_RECENT);
    await store.set(STORE_KEY, updated);
  } catch {
    // Non-critical — ignore errors
  }
}

export async function removeRecentFile(path: string): Promise<void> {
  try {
    const store = await getStore();
    const existing = (await store.get<RecentFile[]>(STORE_KEY)) ?? [];
    await store.set(
      STORE_KEY,
      existing.filter((f) => f.path !== path)
    );
  } catch {
    // Non-critical
  }
}

export async function clearRecentFiles(): Promise<void> {
  try {
    const store = await getStore();
    await store.set(STORE_KEY, []);
  } catch {
    // Non-critical
  }
}
