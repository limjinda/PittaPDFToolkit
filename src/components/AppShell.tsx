import { useRef, useState, useCallback, useEffect } from "react";
import { useWorkspaceStore, useActiveWorkspace } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";
import { AppToolbar } from "@/features/toolbar/AppToolbar";
import { TabBar } from "@/features/toolbar/TabBar";
import { ThumbnailPanel } from "@/features/viewer/ThumbnailPanel";
import { ViewerPane } from "@/features/viewer/ViewerPane";
import { PageGrid } from "@/features/editor/PageGrid";
import { RecentFilesPage } from "@/features/recent/RecentFilesPage";
import { AnnotationToolbar } from "@/features/annotation/AnnotationToolbar";
import { useScrollSync } from "@/features/viewer/hooks/useScrollSync";
import { ToolkitPage } from "@/features/toolkit/ToolkitPage";
import { registerPasswordPrompt } from "@/lib/pdf/pdfLoader";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";

type ViewMode = "viewer" | "grid" | "toolkit";

interface PasswordPromptState {
  docId: string;
  reason: number;
  resolve: (pass: string | null) => void;
}

/** Root layout shell. Composes the tab bar, toolbar, sidebar, and main content area. */
export function AppShell() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspace = useActiveWorkspace();
  const { zoom, currentPage, setCurrentPage, sidebarWidth } = useUIStore();
  const [view, setView] = useState<ViewMode>("viewer");
  const [promptState, setPromptState] = useState<PasswordPromptState | null>(null);
  const [passwordVal, setPasswordVal] = useState("");

  const viewerRef = useRef<HTMLDivElement>(null);
  useScrollSync(viewerRef);

  useEffect(() => {
    registerPasswordPrompt((docId, reason) => {
      return new Promise<string | null>((resolve) => {
        setPromptState({ docId, reason, resolve });
      });
    });

    const handleOpenToolkit = () => setView("toolkit");
    window.addEventListener("open-toolkit", handleOpenToolkit);
    return () => window.removeEventListener("open-toolkit", handleOpenToolkit);
  }, []);

  const scrollToPage = useCallback(
    (index: number) => {
      setCurrentPage(index);
      const el = viewerRef.current?.querySelector(`[data-page-index="${index}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [setCurrentPage]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Tab bar — only visible when workspaces are open */}
        {workspaces.length > 0 && <TabBar />}

        {/* Main toolbar */}
        <AppToolbar view={view} onViewChange={setView} />

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {view === "toolkit" ? (
            <ToolkitPage onViewChange={setView} />
          ) : workspace ? (
            view === "viewer" ? (
              <>
                {/* Thumbnail sidebar */}
                <ThumbnailPanel
                  pages={workspace.pages}
                  sourceDocs={workspace.sourceDocs}
                  currentPage={currentPage}
                  width={sidebarWidth}
                  onPageClick={scrollToPage}
                />

                {/* Annotation tool strip */}
                <AnnotationToolbar />

                {/* Main PDF viewer with annotation overlay */}
                <ViewerPane
                  pages={workspace.pages}
                  sourceDocs={workspace.sourceDocs}
                  zoom={zoom}
                  containerRef={viewerRef}
                  currentPage={currentPage}
                />
              </>
            ) : (
              /* Page grid editor */
              <PageGrid
                workspaceId={workspace.id}
                pages={workspace.pages}
                sourceDocs={workspace.sourceDocs}
              />
            )
          ) : (
            /* No workspace — show home screen */
            <RecentFilesPage onViewChange={setView} />
          )}
        </div>
      </div>

      {promptState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
          <div className="bg-zinc-950/95 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col gap-4 text-zinc-50 relative overflow-hidden">
            {/* Ambient glow effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
            
            <div>
              <h3 className="text-lg font-bold tracking-tight">🔒 Password Required</h3>
              <p className="text-xs text-zinc-400 mt-1">
                {promptState.reason === 2
                  ? "Incorrect password. Please try again."
                  : "This PDF document is encrypted. Enter password to unlock."}
              </p>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = passwordVal;
                setPasswordVal("");
                setPromptState(null);
                promptState.resolve(val);
              }}
              className="flex flex-col gap-4"
            >
              <input
                type="password"
                value={passwordVal}
                onChange={(e) => setPasswordVal(e.target.value)}
                required
                autoFocus
                placeholder="Enter password..."
                className="px-3 py-2 border border-zinc-800 rounded-lg bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-50 placeholder:text-zinc-500"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPasswordVal("");
                    setPromptState(null);
                    promptState.resolve(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
