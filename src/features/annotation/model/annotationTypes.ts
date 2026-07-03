import { v4 as uuidv4 } from "uuid";

// ── Base ───────────────────────────────────────────────────────────────────────

/** Fields shared by every annotation type. */
export interface BaseAnnotation {
  /** Stable UUID. */
  id: string;
  /** The WorkspacePage.id this annotation belongs to. */
  pageId: string;
  /** Left edge as a fraction of page width (0 – 1). */
  x: number;
  /** Top edge as a fraction of page height (0 – 1). */
  y: number;
}

// ── Concrete types ─────────────────────────────────────────────────────────────

export interface TextAnnotation extends BaseAnnotation {
  kind: "text";
  content: string;
  /** Font size in px at scale = 1. */
  fontSize: number;
  /** CSS hex colour, e.g. "#1a1a1a". */
  color: string;
}

export interface CheckmarkAnnotation extends BaseAnnotation {
  kind: "checkmark";
  /** CSS hex colour. */
  color: string;
  /** Rendered width as a fraction of page width. */
  size: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  kind: "highlight";
  /** Width as a fraction of page width. */
  width: number;
  /** Height as a fraction of page height. */
  height: number;
  /** CSS hex colour, e.g. "#fbbf24". */
  color: string;
  /** Fill opacity (0 – 1). */
  opacity: number;
}

export type Annotation = TextAnnotation | CheckmarkAnnotation | HighlightAnnotation;

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_TEXT_COLOR = "#000000";
const DEFAULT_CHECKMARK_COLOR = "#000000";
const DEFAULT_CHECKMARK_SIZE = 0.04;
const DEFAULT_HIGHLIGHT_COLOR = "#fbbf24";
const DEFAULT_HIGHLIGHT_OPACITY = 0.4;

// ── Factory functions ──────────────────────────────────────────────────────────

/**
 * Creates a new empty text annotation at the given page-fraction position.
 * Starts with empty content; the renderer enters edit mode immediately.
 */
export function createTextAnnotation(
  pageId: string,
  x: number,
  y: number
): TextAnnotation {
  return {
    id: uuidv4(),
    pageId,
    x,
    y,
    kind: "text",
    content: "",
    fontSize: DEFAULT_FONT_SIZE,
    color: DEFAULT_TEXT_COLOR,
  };
}

/**
 * Creates a checkmark annotation at the given page-fraction position.
 */
export function createCheckmarkAnnotation(
  pageId: string,
  x: number,
  y: number
): CheckmarkAnnotation {
  return {
    id: uuidv4(),
    pageId,
    x,
    y,
    kind: "checkmark",
    color: DEFAULT_CHECKMARK_COLOR,
    size: DEFAULT_CHECKMARK_SIZE,
  };
}

/**
 * Creates a highlight annotation for the given page-fraction rectangle.
 * Normalises negative width/height produced by right-to-left or bottom-to-top drags.
 */
export function createHighlightAnnotation(
  pageId: string,
  x: number,
  y: number,
  width: number,
  height: number
): HighlightAnnotation {
  return {
    id: uuidv4(),
    pageId,
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    kind: "highlight",
    width: Math.abs(width),
    height: Math.abs(height),
    color: DEFAULT_HIGHLIGHT_COLOR,
    opacity: DEFAULT_HIGHLIGHT_OPACITY,
  };
}
