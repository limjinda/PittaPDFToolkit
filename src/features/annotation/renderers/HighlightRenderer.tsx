import { useRef, useState } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import type { HighlightAnnotation } from "../model/annotationTypes";

interface Props {
  annotation: HighlightAnnotation;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/**
 * Renders a highlight annotation as a semi-transparent rectangle.
 * Position and size use CSS percentages (page-fraction × 100) so the
 * highlight scales correctly at any zoom level without reading canvas pixels.
 */
export function HighlightRenderer({
  annotation,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const { updateAnnotation, deleteAnnotation } = useAnnotationStore();
  const outline = isSelected ? "1.5px dashed var(--color-primary)" : "none";

  const [tempSize, setTempSize] = useState<{ width: number; height: number } | null>(null);

  const resizeState = useRef<{
    startClientX: number;
    startClientY: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);

  function handleResizeDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origWidth: annotation.width,
      origHeight: annotation.height,
    };
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const rs = resizeState.current;
    if (!rs) return;
    const layer = e.currentTarget.closest(".pdf-annotation-layer");
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const dx = (e.clientX - rs.startClientX) / rect.width;
    const dy = (e.clientY - rs.startClientY) / rect.height;
    
    setTempSize({
      width: Math.max(0.01, rs.origWidth + dx),
      height: Math.max(0.01, rs.origHeight + dy),
    });
  }

  function handleResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (resizeState.current && tempSize) {
      updateAnnotation(annotation.id, {
        width: tempSize.width,
        height: tempSize.height,
      });
    }
    resizeState.current = null;
    setTempSize(null);
  }

  const w = tempSize ? tempSize.width : annotation.width;
  const h = tempSize ? tempSize.height : annotation.height;

  return (
    <div
      style={{
        position: "absolute",
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        outline,
        outlineOffset: 1,
        borderRadius: 1,
        pointerEvents: "auto",
        cursor: isSelected ? "move" : "pointer",
        zIndex: isSelected ? 10 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Isolated background layer for multiply blend mode */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: annotation.color,
          opacity: annotation.opacity,
          mixBlendMode: "multiply",
          borderRadius: 1,
          pointerEvents: "none",
        }}
      />

      {isSelected && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          style={{
            position: "absolute",
            bottom: -5,
            right: -5,
            width: 10,
            height: 10,
            backgroundColor: "hsl(var(--primary))",
            border: "1.5px solid hsl(var(--background))",
            borderRadius: "50%",
            cursor: "se-resize",
            zIndex: 60,
          }}
        />
      )}

      {isSelected && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            backgroundColor: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            padding: "4px 6px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            zIndex: 50,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => deleteAnnotation(annotation.id)}
            title="Delete highlight"
            style={{
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: "bold",
              borderRadius: 4,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--background))",
              cursor: "pointer",
              color: "hsl(var(--destructive))",
            }}
            className="hover:bg-destructive/10"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
