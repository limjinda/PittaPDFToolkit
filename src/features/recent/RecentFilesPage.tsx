import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";
import { getRecentFiles, removeRecentFile, type RecentFile } from "@/lib/tauri/recentStore";
import { openPdfs } from "@/lib/tauri/fileDialog";
import { addRecentFile } from "@/lib/tauri/recentStore";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function RecentFilesPage() {
  const { createWorkspace } = useWorkspaceStore();
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    getRecentFiles().then(setRecentFiles);
  }, []);

  async function handleOpen() {
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
  }

  async function handleOpenRecent(file: RecentFile) {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(file.path);
      const uint8 = new Uint8Array(bytes);
      const doc = await loadPdfDoc(file.path, uint8);

      createWorkspace([
        {
          path: file.path,
          name: file.name,
          bytes: uint8,
          numPages: doc.numPages,
        },
      ]);

      await addRecentFile({
        ...file,
        lastOpened: Date.now(),
        pageCount: doc.numPages,
      });

      setRecentFiles(await getRecentFiles());
    } catch {
      // File may have been moved/deleted — remove from recent list
      await removeRecentFile(file.path);
      setRecentFiles(await getRecentFiles());
    }
  }

  async function handleRemove(e: React.MouseEvent, path: string) {
    e.stopPropagation();
    await removeRecentFile(path);
    setRecentFiles(await getRecentFiles());
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start pt-16 px-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">📄</div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">PDF Toolbox</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Fast, offline PDF utilities. Open, edit, merge, split, and save — no cloud, no login.
        </p>
      </div>

      {/* Open button */}
      <Button
        size="lg"
        onClick={handleOpen}
        className="mb-10 gap-2 px-8 text-base font-semibold shadow-lg"
      >
        📂 Open PDF
      </Button>

      {/* Recent files */}
      {recentFiles.length > 0 && (
        <div className="w-full max-w-lg">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Recent Files
          </h2>
          <div className="space-y-1">
            {recentFiles.map((file) => (
              <div
                key={file.path}
                className="relative flex items-center rounded-lg group hover:bg-accent transition-colors"
              >
                <button
                  onClick={() => handleOpenRecent(file)}
                  className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left min-w-0"
                >
                  <span className="text-2xl shrink-0">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {file.path}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-muted-foreground pr-1">
                    <div>{file.pageCount} pages</div>
                    <div>{formatRelativeTime(new Date(file.lastOpened))}</div>
                  </div>
                </button>

                {/* Remove button — visible on row hover */}
                <button
                  onClick={(e) => handleRemove(e, file.path)}
                  title="Remove from recent"
                  className="shrink-0 mr-2 w-6 h-6 flex items-center justify-center rounded-md
                    text-muted-foreground hover:text-destructive hover:bg-destructive/10
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop hint */}
      <p className="mt-10 text-xs text-muted-foreground/60 text-center">
        Or drag & drop PDF files anywhere on this window
      </p>
    </div>
  );
}
