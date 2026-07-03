import { useEffect } from "react";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";
import { useAnnotationStore } from "@/store/annotationStore";
import { openPdfs, savePdf, getSystemFontBytes } from "@/lib/tauri/fileDialog";
import { addRecentFile } from "@/lib/tauri/recentStore";
import { exportWorkspace } from "@/lib/pdf/pdfExporter";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

/**
 * Global keyboard shortcut handler.
 * Mounts once at the app root via useEffect.
 *
 * Priority order for Ctrl+Z:
 *   1. Annotation undo (if annotation history exists)
 *   2. Workspace page-order undo
 */
export function KeyboardShortcuts() {
  const { createWorkspace } = useWorkspaceStore();
  const workspace = useActiveWorkspace();
  const { zoomIn, zoomOut, resetZoom } = useUIStore();

  useEffect(() => {
    const workspaceUndo = () => useWorkspaceStore.temporal.getState().undo();
    const workspaceRedo = () => useWorkspaceStore.temporal.getState().redo();
    const annotationUndo = () => useAnnotationStore.temporal.getState().undo();
    const annotationRedo = () => useAnnotationStore.temporal.getState().redo();

    async function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;

      // Don't fire shortcuts when the user is typing in an input or textarea
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // ── Annotation tool shortcuts (only when a document is open) ──────────
      const { setTool, selectedId, deleteAnnotation, copySelected, paste } =
        useAnnotationStore.getState();

      if (!ctrl && workspace) {
        if (e.code === "KeyV") { setTool("select");    return; }
        if (e.code === "KeyT") { setTool("text");      return; }
        if (e.code === "KeyK") { setTool("checkmark"); return; }
        if (e.code === "KeyH") { setTool("highlight"); return; }
      }

      if (e.key === "Escape") {
        setTool("select");
        useAnnotationStore.getState().selectAnnotation(null);
        return;
      }

      // Delete selected annotation (takes priority over page delete)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteAnnotation(selectedId);
        return;
      }

      // Ctrl+C — copy selected annotation
      if (ctrl && e.code === "KeyC" && selectedId) {
        e.preventDefault();
        copySelected();
        return;
      }

      // Ctrl+V — paste annotation onto current page
      if (ctrl && e.code === "KeyV" && workspace) {
        const { clipboard } = useAnnotationStore.getState();
        if (clipboard) {
          e.preventDefault();
          const { currentPage } = useUIStore.getState();
          const pageId = workspace.pages[currentPage]?.id;
          if (pageId) paste(pageId);
          return;
        }
      }

      // ── File operations ────────────────────────────────────────────────────

      if (ctrl && e.code === "KeyO") {
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

      if (ctrl && e.code === "KeyS" && workspace) {
        e.preventDefault();
        try {
          const fontBytes = await getSystemFontBytes();
          const { byPage } = useAnnotationStore.getState();
          const bytes = await exportWorkspace(workspace, workspace.sourceDocs, byPage, fontBytes);
          const defaultName = workspace.title.replace(/\.pdf$/i, "") + "_modified.pdf";
          const savedPath = await savePdf(defaultName, bytes);
          if (savedPath) {
            useWorkspaceStore.getState().markSaved(workspace.id);
          }
        } catch (error) {
          console.error("Save failed:", error);
          alert("Failed to save PDF: " + (error instanceof Error ? error.message : String(error)));
        }
        return;
      }

      // ── Undo / Redo ────────────────────────────────────────────────────────

      if (ctrl && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        const { pastStates } = useAnnotationStore.temporal.getState();
        if (pastStates.length > 0) annotationUndo();
        else workspaceUndo();
        return;
      }

      if ((ctrl && e.shiftKey && e.code === "KeyZ") || (ctrl && e.code === "KeyY")) {
        e.preventDefault();
        const { futureStates } = useAnnotationStore.temporal.getState();
        if (futureStates.length > 0) annotationRedo();
        else workspaceRedo();
        return;
      }

      // ── Zoom ──────────────────────────────────────────────────────────────

      if (ctrl && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomIn();   return; }
      if (ctrl && e.key === "-")                     { e.preventDefault(); zoomOut();  return; }
      if (ctrl && e.code === "Digit0")               { e.preventDefault(); resetZoom(); return; }

      // ── Page navigation & page-level ops ──────────────────────────────────

      if (!workspace) return;

      const { currentPage, setCurrentPage } = useUIStore.getState();

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentPage + 1, workspace.pages.length - 1);
        setCurrentPage(next);
        document.querySelector(`[data-page-index="${next}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentPage - 1, 0);
        setCurrentPage(prev);
        document.querySelector(`[data-page-index="${prev}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // Delete selected pages (only if no annotation is selected — handled above)
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedPageIds } = useUIStore.getState();
        if (selectedPageIds.size > 0) {
          e.preventDefault();
          useWorkspaceStore.getState().deletePages(workspace.id, [...selectedPageIds]);
          useUIStore.getState().clearSelection();
        }
        return;
      }

      // R — rotate selected pages CW
      if (e.code === "KeyR") {
        const { selectedPageIds } = useUIStore.getState();
        if (selectedPageIds.size > 0) {
          e.preventDefault();
          useWorkspaceStore.getState().rotatePages(workspace.id, [...selectedPageIds], "cw");
        }
      }
    }

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [workspace, createWorkspace, zoomIn, zoomOut, resetZoom]);

  return null;
}
