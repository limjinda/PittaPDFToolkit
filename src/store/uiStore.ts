import { create } from "zustand";
import { clamp } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

interface UIState {
  zoom: number;           // 0.25 – 4.0
  currentPage: number;    // 0-based index
  theme: Theme;
  sidebarWidth: number;   // px
  sidebarVisible: boolean;
  selectedPageIds: Set<string>;

  setZoom(zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  setCurrentPage(page: number): void;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
  setSidebarWidth(width: number): void;
  toggleSidebar(): void;
  selectPage(id: string, multi: boolean): void;
  clearSelection(): void;
  applyTheme(theme: Theme): void;
}

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0];

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDOM(theme: Theme) {
  const isDark = theme === "system" ? getSystemTheme() === "dark" : theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

export const useUIStore = create<UIState>((set, get) => ({
  zoom: 1.0,
  currentPage: 0,
  theme: "system",
  sidebarWidth: 200,
  sidebarVisible: true,
  selectedPageIds: new Set(),

  setZoom(zoom) {
    set({ zoom: clamp(zoom, 0.25, 4.0) });
  },

  zoomIn() {
    const current = get().zoom;
    const next = ZOOM_STEPS.find((s) => s > current + 0.001) ?? 4.0;
    set({ zoom: next });
  },

  zoomOut() {
    const current = get().zoom;
    const prev = [...ZOOM_STEPS].reverse().find((s) => s < current - 0.001) ?? 0.25;
    set({ zoom: prev });
  },

  resetZoom() {
    set({ zoom: 1.0 });
  },

  setCurrentPage(page) {
    set({ currentPage: page });
  },

  setTheme(theme) {
    set({ theme });
    applyThemeToDOM(theme);
    localStorage.setItem("pdf-toolbox-theme", theme);
  },

  toggleTheme() {
    const { theme } = get();
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    get().setTheme(next);
  },

  setSidebarWidth(width) {
    set({ sidebarWidth: clamp(width, 120, 400) });
  },

  toggleSidebar() {
    set((s) => ({ sidebarVisible: !s.sidebarVisible }));
  },

  selectPage(id, multi) {
    set((s) => {
      const next = new Set(s.selectedPageIds);
      if (multi) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        if (next.size === 1 && next.has(id)) next.clear();
        else { next.clear(); next.add(id); }
      }
      return { selectedPageIds: next };
    });
  },

  clearSelection() {
    set({ selectedPageIds: new Set() });
  },

  applyTheme(theme) {
    applyThemeToDOM(theme);
  },
}));
