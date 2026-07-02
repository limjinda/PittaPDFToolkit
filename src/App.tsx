import { useEffect } from "react";
import { AppShell } from "./components/AppShell";
import { DropZone } from "./components/DropZone";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { useUIStore } from "./store/uiStore";
import "./lib/pdf/pdfWorker"; // initialize pdf.js worker

export default function App() {
  const { theme, applyTheme } = useUIStore();

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("pdf-toolbox-theme") as
      | "light"
      | "dark"
      | "system"
      | null;
    if (saved) {
      useUIStore.getState().setTheme(saved);
    } else {
      applyTheme(theme);
    }

    // Listen for system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useUIStore.getState().theme === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DropZone>
      <KeyboardShortcuts />
      <AppShell />
    </DropZone>
  );
}
