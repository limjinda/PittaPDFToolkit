import { useEffect, useRef, useState } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import type { TextAnnotation } from "../model/annotationTypes";

interface Props {
  annotation: TextAnnotation;
  /** Current viewer zoom scale (passed down from PageCanvas). */
  scale: number;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/**
 * Renders a text annotation.
 * - Single pointer-down (in select mode): selects and enables dragging.
 * - Double-click: enters inline edit mode.
 * - Escape or blur: exits edit mode. Deletes empty annotations on blur.
 */
export function TextRenderer({
  annotation,
  scale,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props) {
  const { updateAnnotation, deleteAnnotation } = useAnnotationStore();
  // Start in edit mode when freshly created (empty content)
  const [editing, setEditing] = useState(annotation.content === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
  }

  function handleBlur() {
    setEditing(false);
    if (annotation.content.trim() === "") {
      deleteAnnotation(annotation.id);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    updateAnnotation(annotation.id, { content: e.target.value });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setEditing(false);
    }
  }

  const fontSize = annotation.fontSize * scale;
  const outline = isSelected ? "1.5px dashed var(--color-primary)" : "none";

  return (
    <div
      style={{
        position: "absolute",
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        minWidth: 80,
        cursor: isSelected ? "move" : "default",
        outline,
        outlineOffset: 2,
        borderRadius: 2,
        padding: "1px 2px",
        userSelect: editing ? "text" : "none",
      }}
      onPointerDown={editing ? (e) => e.stopPropagation() : onPointerDown}
      onPointerMove={editing ? undefined : onPointerMove}
      onPointerUp={editing ? undefined : onPointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {isSelected && !editing && (
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
                fontSize: Math.max(8, annotation.fontSize - 2),
              });
            }}
            title="Decrease font size"
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
            {annotation.fontSize}px
          </span>
          <button
            onClick={() => {
              updateAnnotation(annotation.id, {
                fontSize: Math.min(72, annotation.fontSize + 2),
              });
            }}
            title="Increase font size"
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
            onClick={() => setEditing(true)}
            title="Edit text"
            style={{
              padding: "2px 6px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--background))",
              cursor: "pointer",
            }}
            className="hover:bg-accent hover:text-accent-foreground text-foreground"
          >
            ✏️
          </button>
          <button
            onClick={() => deleteAnnotation(annotation.id)}
            title="Delete text"
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

      {editing ? (
        <textarea
          ref={textareaRef}
          value={annotation.content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{
            font: `${fontSize}px Sarabun, sans-serif`,
            color: annotation.color,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "both",
            padding: 0,
            margin: 0,
            minWidth: 80,
            display: "block",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          style={{
            font: `${fontSize}px Sarabun, sans-serif`,
            color: annotation.color,
            whiteSpace: "pre-wrap",
            display: "block",
            minWidth: 80,
            minHeight: fontSize,
          }}
        >
          {annotation.content || " "}
        </span>
      )}
    </div>
  );
}
