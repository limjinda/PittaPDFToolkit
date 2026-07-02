import { useRef, memo } from "react";
import { usePdfRenderer } from "./hooks/usePdfRenderer";
import { cn } from "@/lib/utils";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";

const THUMBNAIL_SCALE = 0.2;

interface ThumbnailProps {
  page: WorkspacePage;
  sourceDocs: Record<string, SourceDoc>;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}

const Thumbnail = memo(function Thumbnail({
  page,
  sourceDocs,
  pageNumber,
  isActive,
  onClick,
}: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePdfRenderer({ page, sourceDocs, scale: THUMBNAIL_SCALE, canvasRef });

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-lg w-full cursor-pointer",
        "transition-all duration-150 group",
        "hover:bg-accent",
        isActive && "bg-primary/10 ring-1 ring-primary"
      )}
    >
      <div
        className={cn(
          "rounded overflow-hidden flex items-center justify-center",
          "border border-border transition-all",
          isActive ? "border-primary shadow-md" : "group-hover:border-muted-foreground/40"
        )}
        style={{ background: "#fff" }}
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
      <span
        className={cn(
          "text-[10px] font-medium tabular-nums leading-none",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        {pageNumber}
      </span>
    </button>
  );
});

interface ThumbnailPanelProps {
  pages: WorkspacePage[];
  sourceDocs: Record<string, SourceDoc>;
  currentPage: number;
  width: number;
  onPageClick: (index: number) => void;
}

export function ThumbnailPanel({
  pages,
  sourceDocs,
  currentPage,
  width,
  onPageClick,
}: ThumbnailPanelProps) {
  return (
    <div
      className="flex flex-col overflow-y-auto overflow-x-hidden border-r border-border shrink-0"
      style={{ width, background: "var(--thumbnail-bg)" }}
    >
      <div className="px-2 py-2 space-y-1">
        {pages.map((page, idx) => (
          <Thumbnail
            key={page.id}
            page={page}
            sourceDocs={sourceDocs}
            pageNumber={idx + 1}
            isActive={idx === currentPage}
            onClick={() => onPageClick(idx)}
          />
        ))}
      </div>
    </div>
  );
}
