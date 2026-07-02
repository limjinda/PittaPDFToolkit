import { useRef, memo } from "react";
import { usePdfRenderer } from "./hooks/usePdfRenderer";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";

interface PageCanvasProps {
  page: WorkspacePage;
  sourceDocs: Record<string, SourceDoc>;
  scale: number;
  pageIndex: number;
}

const PageCanvas = memo(function PageCanvas({
  page,
  sourceDocs,
  scale,
  pageIndex,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePdfRenderer({ page, sourceDocs, scale, canvasRef });

  return (
    <div
      className="pdf-page-container"
      data-page-index={pageIndex}
    >
      <canvas ref={canvasRef} className="pdf-page-canvas" />
    </div>
  );
});

interface ViewerPaneProps {
  pages: WorkspacePage[];
  sourceDocs: Record<string, SourceDoc>;
  zoom: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentPage: number;
}

export function ViewerPane({
  pages,
  sourceDocs,
  zoom,
  containerRef,
  currentPage: _currentPage,
}: ViewerPaneProps) {
  if (pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No pages to display
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-auto"
      style={{ background: "var(--viewer-bg)" }}
    >
      <div className="min-h-full pb-8">
        {pages.map((page, idx) => (
          <PageCanvas
            key={page.id}
            page={page}
            sourceDocs={sourceDocs}
            scale={zoom}
            pageIndex={idx}
          />
        ))}
      </div>
    </div>
  );
}
