import { useRef, memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePdfRenderer } from "@/features/viewer/hooks/usePdfRenderer";
import { cn } from "@/lib/utils";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageGridItemProps {
  page: WorkspacePage;
  sourceDocs: Record<string, SourceDoc>;
  pageNumber: number;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onRotateCW: (id: string) => void;
  onRotateCCW: (id: string) => void;
  onDelete: (id: string) => void;
}

export const PageGridItem = memo(function PageGridItem({
  page,
  sourceDocs,
  pageNumber,
  isSelected,
  onSelect,
  onRotateCW,
  onRotateCCW,
  onDelete,
}: PageGridItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  usePdfRenderer({ page, sourceDocs, scale: 0.25, canvasRef });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col items-center gap-2 p-2 rounded-xl",
        "border-2 transition-all duration-150 cursor-grab active:cursor-grabbing",
        "select-none group",
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-transparent hover:border-border hover:bg-accent"
      )}
      onClick={(e) => onSelect(page.id, e.ctrlKey || e.metaKey || e.shiftKey)}
      {...attributes}
      {...listeners}
    >
      {/* Page canvas */}
      <div
        className="rounded overflow-hidden border border-border bg-white shadow-sm"
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>

      {/* Page number + rotation badge */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {pageNumber}
        </span>
        {page.rotation !== 0 && (
          <span className="text-[9px] px-1 rounded bg-primary/20 text-primary font-semibold">
            {page.rotation}°
          </span>
        )}
      </div>

      {/* Context menu button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "absolute top-1.5 right-1.5 w-6 h-6 rounded-full",
              "bg-background/80 border border-border shadow-sm",
              "flex items-center justify-center",
              "text-muted-foreground hover:text-foreground",
              "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
              "text-xs leading-none"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => onRotateCW(page.id)}>
            ↻ Rotate CW
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRotateCCW(page.id)}>
            ↺ Rotate CCW
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(page.id)}
          >
            🗑 Delete page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
