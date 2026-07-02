import { useState } from "react";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";
import { openPdfs, savePdf } from "@/lib/tauri/fileDialog";
import { addRecentFile } from "@/lib/tauri/recentStore";
import { exportWorkspace } from "@/lib/pdf/pdfExporter";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppToolbarProps {
  view: "viewer" | "grid";
  onViewChange: (v: "viewer" | "grid") => void;
}

export function AppToolbar({ view, onViewChange }: AppToolbarProps) {
  const { createWorkspace, mergePdfs } = useWorkspaceStore();
  const workspace = useActiveWorkspace();
  const { zoom, zoomIn, zoomOut, resetZoom, theme, toggleTheme } = useUIStore();
  const { undo, redo, pastStates, futureStates } = useWorkspaceStore.temporal.getState();
  const [saving, setSaving] = useState(false);

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  async function handleOpen() {
    const files = await openPdfs();
    if (files.length === 0) return;

    const withNumPages = await Promise.all(
      files.map(async (f) => {
        const bytes = new Uint8Array(f.bytes);
        const docId = f.path;
        const doc = await loadPdfDoc(docId, bytes);
        return { path: f.path, name: f.name, bytes, numPages: doc.numPages };
      })
    );

    const wsId = createWorkspace(withNumPages);
    for (const f of withNumPages) {
      await addRecentFile({
        path: f.path,
        name: f.name,
        pageCount: f.numPages,
        lastOpened: Date.now(),
      });
    }
    return wsId;
  }

  async function handleMerge() {
    if (!workspace) return;
    const files = await openPdfs();
    if (files.length === 0) return;

    const withNumPages = await Promise.all(
      files.map(async (f) => {
        const bytes = new Uint8Array(f.bytes);
        const doc = await loadPdfDoc(f.path, bytes);
        return { path: f.path, name: f.name, bytes, numPages: doc.numPages };
      })
    );

    mergePdfs(workspace.id, withNumPages);
  }

  async function handleSave() {
    if (!workspace) return;
    setSaving(true);
    try {
      const bytes = await exportWorkspace(workspace, workspace.sourceDocs);
      const defaultName = workspace.title.replace(/\.pdf$/i, "") + "_modified.pdf";
      const savedPath = await savePdf(defaultName, bytes);
      if (savedPath) {
        useWorkspaceStore.getState().markSaved(workspace.id);
      }
    } finally {
      setSaving(false);
    }
  }

  const zoomPercent = Math.round(zoom * 100);

  const themeIcon =
    theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex items-center gap-1 px-3 border-b border-border bg-card shrink-0"
        style={{ height: "var(--toolbar-height)" }}
      >
        {/* File operations */}
        <Tip label="Open PDF (Ctrl+O)">
          <Button variant="ghost" size="sm" onClick={handleOpen} className="gap-1.5 text-sm">
            <span>📂</span> Open
          </Button>
        </Tip>

        {workspace && (
          <Tip label="Merge another PDF into this document">
            <Button variant="ghost" size="sm" onClick={handleMerge} className="gap-1.5 text-sm">
              <span>⊕</span> Merge
            </Button>
          </Tip>
        )}

        {workspace && (
          <Tip label="Save as new PDF (Ctrl+S)">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className={cn("gap-1.5 text-sm", workspace.isDirty && "text-primary font-semibold")}
            >
              <span>💾</span> {saving ? "Saving…" : "Save As"}
              {workspace.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
            </Button>
          </Tip>
        )}

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Undo / Redo */}
        <Tip label="Undo (Ctrl+Z)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => undo()}
            disabled={!canUndo}
            className="w-8 h-8 text-base"
          >
            ↺
          </Button>
        </Tip>
        <Tip label="Redo (Ctrl+Shift+Z)">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => redo()}
            disabled={!canRedo}
            className="w-8 h-8 text-base"
          >
            ↻
          </Button>
        </Tip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* View toggle */}
        {workspace && (
          <>
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => onViewChange("viewer")}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors",
                  view === "viewer"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                📄 Read
              </button>
              <button
                onClick={() => onViewChange("grid")}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors border-l border-border",
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                ⊞ Edit
              </button>
            </div>
            <Separator orientation="vertical" className="h-5 mx-1" />
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom controls */}
        {workspace && view === "viewer" && (
          <div className="flex items-center gap-0.5">
            <Tip label="Zoom out (Ctrl+-)">
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                className="w-7 h-7 text-base"
              >
                −
              </Button>
            </Tip>
            <button
              onClick={resetZoom}
              className="w-14 text-center text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {zoomPercent}%
            </button>
            <Tip label="Zoom in (Ctrl++)">
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                className="w-7 h-7 text-base"
              >
                +
              </Button>
            </Tip>
            <Separator orientation="vertical" className="h-5 mx-1" />
          </div>
        )}

        {/* Theme toggle */}
        <Tip label="Toggle theme">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="w-8 h-8 text-base"
          >
            {themeIcon}
          </Button>
        </Tip>
      </div>
    </TooltipProvider>
  );
}

function Tip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
