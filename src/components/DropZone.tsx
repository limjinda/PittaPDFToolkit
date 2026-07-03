import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";
import { addRecentFile } from "@/lib/tauri/recentStore";

interface DropZoneProps {
  children: React.ReactNode;
}

/**
 * Full-window drag & drop overlay for PDF files.
 *
 * Uses Tauri's native onDragDropEvent (event.payload.type):
 *   "enter" | "over" → show overlay
 *   "drop"           → read files and process
 *   "leave"          → hide overlay
 *
 * When a PDF is dropped onto an existing workspace, merges it in.
 * When dropped on the empty state, creates a new workspace.
 */
export function DropZone({ children }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { createWorkspace, mergePdfs } = useWorkspaceStore();
  const activeWorkspace = useActiveWorkspace();

  // Keep a ref so the Tauri listener closure always sees the latest value
  const activeWorkspaceRef = useRef(activeWorkspace);
  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  const processEntries = useCallback(
    async (
      entries: { path: string; name: string; bytes: Uint8Array }[]
    ) => {
      if (entries.length === 0) return;

      const withNumPages = await Promise.all(
        entries.map(async (entry) => {
          const doc = await loadPdfDoc(
            entry.path + entry.bytes.length,
            entry.bytes
          );
          return {
            path: entry.path,
            name: entry.name,
            bytes: entry.bytes,
            numPages: doc.numPages,
          };
        })
      );

      const ws = activeWorkspaceRef.current;
      if (ws) {
        mergePdfs(ws.id, withNumPages);
      } else {
        createWorkspace(withNumPages);
        for (const f of withNumPages) {
          await addRecentFile({
            path: f.path,
            name: f.name,
            pageCount: f.numPages,
            lastOpened: Date.now(),
          });
        }
      }
    },
    [createWorkspace, mergePdfs]
  );

  // ── Tauri native file-drop listener ────────────────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const { type } = event.payload as {
          type: "enter" | "over" | "drop" | "leave";
          paths?: string[];
        };

        if (type === "enter" || type === "over") {
          setIsDragOver(true);
          return;
        }

        if (type === "leave") {
          setIsDragOver(false);
          return;
        }

        if (type === "drop") {
          setIsDragOver(false);

          const { paths = [] } = event.payload as { paths: string[] };
          const pdfPaths = paths.filter((p) =>
            p.toLowerCase().endsWith(".pdf")
          );

          if (pdfPaths.length === 0) return;

          try {
            const entries = await Promise.all(
              pdfPaths.map(async (filePath) => {
                const file = await invoke<{
                  path: string;
                  name: string;
                  bytes: number[];
                }>("read_pdf_by_path", { path: filePath });
                return {
                  path: file.path,
                  name: file.name,
                  bytes: new Uint8Array(file.bytes),
                };
              })
            );
            await processEntries(entries);
          } catch (err) {
            console.error("Failed to read dropped file(s):", err);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [processEntries]);

  return (
    <div className="relative flex flex-col h-full w-full">
      {children}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm" />
          <div className="relative z-10 text-center">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-lg font-semibold text-primary">
              {activeWorkspace
                ? "Merge PDF into current document"
                : "Drop PDF to open"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Release to {activeWorkspace ? "merge" : "open"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
