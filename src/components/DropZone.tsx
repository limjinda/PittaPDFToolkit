import { useState, useCallback } from "react";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";
import { addRecentFile } from "@/lib/tauri/recentStore";

interface DropZoneProps {
  children: React.ReactNode;
}

/**
 * Full-window drag & drop overlay for PDF files.
 * When a PDF is dropped onto an existing workspace, merges it in.
 * When dropped on the empty state, creates a new workspace.
 */
export function DropZone({ children }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { createWorkspace, mergePdfs } = useWorkspaceStore();
  const activeWorkspace = useActiveWorkspace();

  const processFiles = useCallback(
    async (fileList: FileList) => {
      const pdfs = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) return;

      const withNumPages = await Promise.all(
        pdfs.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const doc = await loadPdfDoc(file.name + file.size, bytes);
          return {
            path: file.name, // no real path in browser drop, use name
            name: file.name,
            bytes,
            numPages: doc.numPages,
          };
        })
      );

      if (activeWorkspace) {
        mergePdfs(activeWorkspace.id, withNumPages);
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
    [activeWorkspace, createWorkspace, mergePdfs]
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only hide if leaving the window
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  }

  return (
    <div
      className="relative flex flex-col h-full w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm" />
          <div className="relative z-10 text-center">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-lg font-semibold text-primary">
              {activeWorkspace ? "Merge PDF into current document" : "Drop PDF to open"}
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
