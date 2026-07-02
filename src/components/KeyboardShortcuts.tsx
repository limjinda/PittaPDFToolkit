import { useEffect } from "react";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";
import { openPdfs } from "@/lib/tauri/fileDialog";
import { savePdf } from "@/lib/tauri/fileDialog";
import { addRecentFile } from "@/lib/tauri/recentStore";
import { exportWorkspace } from "@/lib/pdf/pdfExporter";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

/**
 * Global keyboard shortcut handler.
 * Mounts once at the app root via useEffect.
 */
export function KeyboardShortcuts() {
  const { createWorkspace } = useWorkspaceStore();
  const workspace = useActiveWorkspace();
  const { zoomIn, zoomOut, resetZoom } = useUIStore();

  useEffect(() => {
    const undo = () => useWorkspaceStore.temporal.getState().undo();
    const redo = () => useWorkspaceStore.temporal.getState().redo();

    async function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;

      // Don't fire shortcuts when typing in an input
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // Ctrl+O — Open
      if (ctrl && e.key === "o") {
        e.preventDefault();
        const files = await openPdfs();
        if (files.length === 0) return;
        const withNumPages = await Promise.all(
          files.map(async (f) => {
            const bytes = new Uint8Array(f.bytes);
            const doc = await loadPdfDoc(f.path, bytes);
            return { path: f.path, name: f.name, bytes, numPages: doc.numPages };
          })
        );
        createWorkspace(withNumPages);
        for (const f of withNumPages) {
          await addRecentFile({
            path: f.path,
            name: f.name,
            pageCount: f.numPages,
            lastOpened: Date.now(),
          });
        }
        return;
      }

      // Ctrl+S — Save As
      if (ctrl && e.key === "s" && workspace) {
        e.preventDefault();
        const bytes = await exportWorkspace(workspace, workspace.sourceDocs);
        const defaultName = workspace.title.replace(/\.pdf$/i, "") + "_modified.pdf";
        const savedPath = await savePdf(defaultName, bytes);
        if (savedPath) {
          useWorkspaceStore.getState().markSaved(workspace.id);
        }
        return;
      }

      // Ctrl+Z — Undo
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — Redo
      if ((ctrl && e.shiftKey && e.key === "z") || (ctrl && e.key === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom shortcuts
      if (ctrl && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (ctrl && e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (ctrl && e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }

      // Page navigation
      if (workspace) {
        const { currentPage, setCurrentPage } = useUIStore.getState();
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(currentPage + 1, workspace.pages.length - 1);
          setCurrentPage(next);
          // Scroll to page
          const el = document.querySelector(`[data-page-index="${next}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(currentPage - 1, 0);
          setCurrentPage(prev);
          const el = document.querySelector(`[data-page-index="${prev}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        // Delete selected pages
        if (e.key === "Delete" || e.key === "Backspace") {
          const { selectedPageIds } = useUIStore.getState();
          if (selectedPageIds.size > 0) {
            e.preventDefault();
            useWorkspaceStore
              .getState()
              .deletePages(workspace.id, [...selectedPageIds]);
            useUIStore.getState().clearSelection();
          }
          return;
        }

        // R — rotate selected CW
        if (e.key === "r" || e.key === "R") {
          const { selectedPageIds } = useUIStore.getState();
          if (selectedPageIds.size > 0) {
            e.preventDefault();
            useWorkspaceStore
              .getState()
              .rotatePages(workspace.id, [...selectedPageIds], "cw");
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspace, createWorkspace, zoomIn, zoomOut, resetZoom]);

  return null;
}
