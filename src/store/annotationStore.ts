import { create } from "zustand";
import { temporal } from "zundo";
import type { Annotation } from "@/features/annotation/model/annotationTypes";

/** Which tool is currently active in the annotation toolbar. */
export type AnnotationTool = "select" | "text" | "checkmark" | "highlight";

/** Pixel offset applied to x/y when pasting a copied annotation. */
const PASTE_OFFSET = 0.02;

interface AnnotationState {
  /** All annotations keyed by pageId. */
  byPage: Record<string, Annotation[]>;
  /** Currently active drawing/editing tool. */
  activeTool: AnnotationTool;
  /** ID of the selected annotation, or null. */
  selectedId: string | null;
  /** Last copied annotation (clipboard), or null. */
  clipboard: Annotation | null;
}

interface AnnotationActions {
  /** Switch the active tool and clear selection. */
  setTool(tool: AnnotationTool): void;
  /** Add a new annotation to its page. Tracked in undo history. */
  addAnnotation(annotation: Annotation): void;
  /**
   * Apply a partial update to an existing annotation.
   * Tracked in undo history.
   */
  updateAnnotation(id: string, patch: Partial<Annotation>): void;
  /**
   * Permanently remove an annotation by ID.
   * Clears selection if the removed annotation was selected.
   * Tracked in undo history.
   */
  deleteAnnotation(id: string): void;
  /** Set the currently selected annotation (null to deselect). */
  selectAnnotation(id: string | null): void;
  /** Copy the selected annotation to the in-memory clipboard. */
  copySelected(): void;
  /**
   * Paste the clipboard annotation onto the given page.
   * The copy is offset slightly so it is visually separated from the original.
   */
  paste(pageId: string): void;
  /** Return all annotations for a page. Safe to call outside React (non-reactive). */
  getPageAnnotations(pageId: string): Annotation[];
}

type AnnotationStore = AnnotationState & AnnotationActions;

export const useAnnotationStore = create<AnnotationStore>()(
  temporal(
    (set, get) => ({
      byPage: {},
      activeTool: "select",
      selectedId: null,
      clipboard: null,

      setTool(tool) {
        set({ activeTool: tool, selectedId: null });
      },

      addAnnotation(annotation) {
        set((state) => {
          const existing = state.byPage[annotation.pageId] ?? [];
          return {
            byPage: {
              ...state.byPage,
              [annotation.pageId]: [...existing, annotation],
            },
          };
        });
      },

      updateAnnotation(id, patch) {
        set((state) => {
          const byPage = { ...state.byPage };
          for (const pageId of Object.keys(byPage)) {
            const list = byPage[pageId];
            const idx = list.findIndex((a) => a.id === id);
            if (idx !== -1) {
              const updated = [...list];
              updated[idx] = { ...updated[idx], ...patch } as Annotation;
              byPage[pageId] = updated;
              break;
            }
          }
          return { byPage };
        });
      },

      deleteAnnotation(id) {
        set((state) => {
          const byPage = { ...state.byPage };
          for (const pageId of Object.keys(byPage)) {
            const filtered = byPage[pageId].filter((a) => a.id !== id);
            if (filtered.length !== byPage[pageId].length) {
              byPage[pageId] = filtered;
              break;
            }
          }
          return {
            byPage,
            selectedId: state.selectedId === id ? null : state.selectedId,
          };
        });
      },

      selectAnnotation(id) {
        set({ selectedId: id });
      },

      copySelected() {
        const { selectedId, byPage } = get();
        if (!selectedId) return;
        for (const list of Object.values(byPage)) {
          const found = list.find((a) => a.id === selectedId);
          if (found) {
            set({ clipboard: found });
            return;
          }
        }
      },

      paste(pageId) {
        const { clipboard } = get();
        if (!clipboard) return;
        const pasted: Annotation = {
          ...clipboard,
          id: crypto.randomUUID(),
          pageId,
          x: Math.min(clipboard.x + PASTE_OFFSET, 0.95),
          y: Math.min(clipboard.y + PASTE_OFFSET, 0.95),
        };
        get().addAnnotation(pasted);
        set({ selectedId: pasted.id });
      },

      getPageAnnotations(pageId) {
        return get().byPage[pageId] ?? [];
      },
    }),
    {
      // Only include byPage in the undo history.
      // Tool, selection, and clipboard changes are not undoable.
      partialize: (state) => ({ byPage: state.byPage }),
      limit: 50,
    }
  )
);
