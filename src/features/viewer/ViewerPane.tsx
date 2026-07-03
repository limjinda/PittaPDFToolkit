import { useRef, memo } from "react";
import { usePdfRenderer } from "./hooks/usePdfRenderer";
import { AnnotationLayer } from "@/features/annotation/AnnotationLayer";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";

interface PageCanvasProps {
  page: WorkspacePage;
  sourceDocs: Record<string, SourceDoc>;
  scale: number;
  pageIndex: number;
}

/**
 * Renders a single PDF page as a <canvas> with an annotation overlay on top.
 * The overlay div is absolutely positioned to cover the canvas exactly.
 */
const PageCanvas = memo(function PageCanvas({
  page,
  sourceDocs,
  scale,
  pageIndex,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePdfRenderer({ page, sourceDocs, scale, canvasRef });

  return (
    <div className="pdf-page-container" data-page-index={pageIndex}>
      {/* Relative wrapper so AnnotationLayer can use absolute positioning */}
      <div style={{ position: "relative", alignSelf: "start" }}>
        <canvas ref={canvasRef} className="pdf-page-canvas" />
        <AnnotationLayer pageId={page.id} scale={scale} />
      </div>
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

/** Scrollable viewer that renders one PageCanvas per workspace page. */
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
