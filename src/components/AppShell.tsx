import { useRef, useState, useCallback } from "react";
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
import {
  TooltipProvider,
} from "@/components/ui/tooltip";

type ViewMode = "viewer" | "grid";

/** Root layout shell. Composes the tab bar, toolbar, sidebar, and main content area. */
export function AppShell() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspace = useActiveWorkspace();
  const { zoom, currentPage, setCurrentPage, sidebarWidth } = useUIStore();
  const [view, setView] = useState<ViewMode>("viewer");

  const viewerRef = useRef<HTMLDivElement>(null);
  useScrollSync(viewerRef);

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
          {workspace ? (
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
            <RecentFilesPage />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
