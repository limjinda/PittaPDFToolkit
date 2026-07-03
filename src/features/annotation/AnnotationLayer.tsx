import { useRef, useState } from "react";
import { useAnnotationStore } from "@/store/annotationStore";
import {
  createTextAnnotation,
  createCheckmarkAnnotation,
  createHighlightAnnotation,
  type Annotation,
} from "./model/annotationTypes";
import { TextRenderer } from "./renderers/TextRenderer";
import { CheckmarkRenderer } from "./renderers/CheckmarkRenderer";
import { HighlightRenderer } from "./renderers/HighlightRenderer";

interface Props {
  pageId: string;
  /** Current viewer zoom scale — forwarded to text renderer for font sizing. */
  scale: number;
}

interface DraftRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimum drag size (page fractions) required to commit a highlight annotation. */
const MIN_HIGHLIGHT_SIZE = 0.01;

/**
 * Per-page annotation overlay.
 * Rendered as `position: absolute; inset: 0` on top of the PDF canvas.
 * All annotation creation, selection and dragging is handled here.
 */
export function AnnotationLayer({ pageId, scale }: Props) {
  const store = useAnnotationStore();
  const annotations = store.byPage[pageId] ?? [];
  const { activeTool, selectedId } = store;

  const layerRef = useRef<HTMLDivElement>(null);

  // Active drag state for creating a highlight
  const highlightOrigin = useRef<{ fx: number; fy: number } | null>(null);
  const [draft, setDraft] = useState<DraftRect | null>(null);

  // Active drag state for moving a selected annotation
  const moveState = useRef<{
    annotationId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  /** Convert a client-space point to page fractions (0–1). */
  function toFraction(clientX: number, clientY: number): [number, number] {
    const layer = layerRef.current;
    if (!layer) return [0, 0];
    const rect = layer.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const fy = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return [fx, fy];
  }

  // ── Blank area pointer events ──────────────────────────────────────────────

  function handleLayerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only act when the pointer hits the layer itself, not a child annotation
    if (e.target !== layerRef.current) return;

    const [fx, fy] = toFraction(e.clientX, e.clientY);

    if (activeTool === "select") {
      store.selectAnnotation(null);
      return;
    }

    if (activeTool === "text") {
      const ann = createTextAnnotation(pageId, fx, fy);
      store.addAnnotation(ann);
      store.selectAnnotation(ann.id);
      store.setTool("select");
      return;
    }

    if (activeTool === "checkmark") {
      const ann = createCheckmarkAnnotation(pageId, fx, fy);
      store.addAnnotation(ann);
      store.selectAnnotation(ann.id);
      store.setTool("select");
      
      // Capture the pointer and set up moveState so the user can drag immediately!
      e.currentTarget.setPointerCapture(e.pointerId);
      moveState.current = {
        annotationId: ann.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: ann.x,
        origY: ann.y,
      };
      return;
    }

    if (activeTool === "highlight") {
      e.currentTarget.setPointerCapture(e.pointerId);
      highlightOrigin.current = { fx, fy };
      setDraft({ x: fx, y: fy, width: 0, height: 0 });
    }
  }

  function handleLayerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (moveState.current) {
      handleAnnotationPointerMove(e);
      return;
    }
    if (!highlightOrigin.current) return;
    const [fx, fy] = toFraction(e.clientX, e.clientY);
    setDraft({
      x: highlightOrigin.current.fx,
      y: highlightOrigin.current.fy,
      width: fx - highlightOrigin.current.fx,
      height: fy - highlightOrigin.current.fy,
    });
  }

  function handleLayerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (moveState.current) {
      handleAnnotationPointerUp();
      return;
    }
    if (!highlightOrigin.current) return;
    const [fx, fy] = toFraction(e.clientX, e.clientY);
    const w = fx - highlightOrigin.current.fx;
    const h = fy - highlightOrigin.current.fy;

    if (Math.abs(w) > MIN_HIGHLIGHT_SIZE && Math.abs(h) > MIN_HIGHLIGHT_SIZE) {
      const ann = createHighlightAnnotation(
        pageId,
        highlightOrigin.current.fx,
        highlightOrigin.current.fy,
        w,
        h
      );
      store.addAnnotation(ann);
      store.selectAnnotation(ann.id);
      store.setTool("select");
    }

    highlightOrigin.current = null;
    setDraft(null);
  }

  // ── Annotation-level pointer events (select + move) ────────────────────────

  function handleAnnotationPointerDown(e: React.PointerEvent, ann: Annotation) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    // Automatically switch to select tool if another tool was active
    if (activeTool !== "select") {
      store.setTool("select");
    }
    
    store.selectAnnotation(ann.id);
    moveState.current = {
      annotationId: ann.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: ann.x,
      origY: ann.y,
    };
  }

  function handleAnnotationPointerMove(e: React.PointerEvent) {
    const ms = moveState.current;
    if (!ms) return;
    const layer = layerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const dx = (e.clientX - ms.startClientX) / rect.width;
    const dy = (e.clientY - ms.startClientY) / rect.height;
    store.updateAnnotation(ms.annotationId, {
      x: Math.max(0, Math.min(0.97, ms.origX + dx)),
      y: Math.max(0, Math.min(0.97, ms.origY + dy)),
    });
  }

  function handleAnnotationPointerUp() {
    moveState.current = null;
  }

  // ── Cursor style ───────────────────────────────────────────────────────────

  const cursor =
    activeTool === "text" ? "text"
    : activeTool === "highlight" ? "crosshair"
    : activeTool === "checkmark" ? "crosshair"
    : "default";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={layerRef}
      className="pdf-annotation-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        cursor,
        // Don't block scrolling when in select mode with nothing to interact
        pointerEvents: activeTool === "select" && !selectedId && annotations.length === 0
          ? "none"
          : "auto",
      }}
      onPointerDown={handleLayerPointerDown}
      onPointerMove={handleLayerPointerMove}
      onPointerUp={handleLayerPointerUp}
    >
      {annotations.map((ann) => {
        const isSelected = ann.id === selectedId;
        const handlers = {
          onPointerDown: (e: React.PointerEvent) => handleAnnotationPointerDown(e, ann),
          onPointerMove: handleAnnotationPointerMove,
          onPointerUp: handleAnnotationPointerUp,
        };

        if (ann.kind === "text") {
          return (
            <TextRenderer
              key={ann.id}
              annotation={ann}
              scale={scale}
              isSelected={isSelected}
              {...handlers}
            />
          );
        }
        if (ann.kind === "checkmark") {
          return (
            <CheckmarkRenderer
              key={ann.id}
              annotation={ann}
              isSelected={isSelected}
              {...handlers}
            />
          );
        }
        if (ann.kind === "highlight") {
          return (
            <HighlightRenderer
              key={ann.id}
              annotation={ann}
              isSelected={isSelected}
              {...handlers}
            />
          );
        }
        return null;
      })}

      {/* Live highlight preview while dragging */}
      {draft && (
        <div
          style={{
            position: "absolute",
            left: `${(draft.width < 0 ? draft.x + draft.width : draft.x) * 100}%`,
            top: `${(draft.height < 0 ? draft.y + draft.height : draft.y) * 100}%`,
            width: `${Math.abs(draft.width) * 100}%`,
            height: `${Math.abs(draft.height) * 100}%`,
            backgroundColor: "#fbbf24",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
