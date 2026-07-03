import type { CheckmarkAnnotation } from "../model/annotationTypes";
import { useAnnotationStore } from "@/store/annotationStore";

interface Props {
  annotation: CheckmarkAnnotation;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/**
 * Renders a checkmark annotation as an inline SVG polyline.
 * Size is proportional to page width via CSS percentage.
 */
export function CheckmarkRenderer({
  annotation,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const { updateAnnotation, deleteAnnotation } = useAnnotationStore();
  const outline = isSelected ? "1.5px dashed var(--color-primary)" : "none";

  return (
    <div
      style={{
        position: "absolute",
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        width: `${annotation.size * 100}%`,
        aspectRatio: "1",
        cursor: isSelected ? "move" : "pointer",
        outline,
        outlineOffset: 2,
        borderRadius: 2,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
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
            gap: 4,
            backgroundColor: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            padding: "4px 6px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            zIndex: 50,
            whiteSpace: "nowrap",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              updateAnnotation(annotation.id, {
                size: Math.max(0.01, annotation.size - 0.005),
              });
            }}
            title="Decrease size"
            style={{
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: "bold",
              borderRadius: 4,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--background))",
              cursor: "pointer",
            }}
            className="hover:bg-accent hover:text-accent-foreground text-foreground"
          >
            A-
          </button>
          <span style={{ fontSize: 11, fontWeight: "500", minWidth: 32, textAlign: "center" }} className="text-foreground">
            {Math.round(annotation.size * 100)}%
          </span>
          <button
            onClick={() => {
              updateAnnotation(annotation.id, {
                size: Math.min(0.20, annotation.size + 0.005),
              });
            }}
            title="Increase size"
            style={{
              padding: "2px 6px",
              fontSize: 11,
              fontWeight: "bold",
              borderRadius: 4,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--background))",
              cursor: "pointer",
            }}
            className="hover:bg-accent hover:text-accent-foreground text-foreground"
          >
            A+
          </button>
          <div style={{ width: 1, height: 14, backgroundColor: "hsl(var(--border))", margin: "0 2px" }} />
          <button
            onClick={() => deleteAnnotation(annotation.id)}
            title="Delete checkmark"
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

      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={annotation.color}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <polyline points="4,13 9,18 20,7" />
      </svg>
    </div>
  );
}
