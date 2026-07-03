import { create } from "zustand";
import { temporal } from "zundo";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceDoc {
  id: string;
  filePath: string;
  fileName: string;
  bytes: Uint8Array;
  numPages: number;
}

export interface WorkspacePage {
  id: string;           // stable UUID for React keys / dnd-kit
  sourceDocId: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface Workspace {
  id: string;
  title: string;
  pages: WorkspacePage[];
  sourceDocs: Record<string, SourceDoc>;
  isDirty: boolean;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

interface WorkspaceActions {
  // Workspace management
  createWorkspace(files: Array<{ path: string; name: string; bytes: Uint8Array; numPages: number }>): string;
  closeWorkspace(id: string): void;
  setActiveWorkspace(id: string): void;

  // Page operations (tracked in undo history)
  deletePage(workspaceId: string, pageId: string): void;
  deletePages(workspaceId: string, pageIds: string[]): void;
  rotatePage(workspaceId: string, pageId: string, direction: "cw" | "ccw"): void;
  rotatePages(workspaceId: string, pageIds: string[], direction: "cw" | "ccw"): void;
  reorderPages(workspaceId: string, fromIndex: number, toIndex: number): void;

  // Document-level operations
  mergePdfs(workspaceId: string, files: Array<{ path: string; name: string; bytes: Uint8Array; numPages: number }>): void;
  splitWorkspace(workspaceId: string, afterPageIndex: number): void;

  markSaved(workspaceId: string): void;
}

type FullStore = WorkspaceState & WorkspaceActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPages(sourceDocId: string, numPages: number): WorkspacePage[] {
  return Array.from({ length: numPages }, (_, i) => ({
    id: uuidv4(),
    sourceDocId,
    sourcePageIndex: i,
    rotation: 0,
  }));
}

function rotationStep(
  current: 0 | 90 | 180 | 270,
  direction: "cw" | "ccw"
): 0 | 90 | 180 | 270 {
  const delta = direction === "cw" ? 90 : -90;
  return (((current + delta) % 360 + 360) % 360) as 0 | 90 | 180 | 270;
}

function updateWorkspace(
  workspaces: Workspace[],
  id: string,
  updater: (ws: Workspace) => Partial<Workspace>
): Workspace[] {
  return workspaces.map((ws) =>
    ws.id === id ? { ...ws, ...updater(ws), isDirty: true } : ws
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceStore = create<FullStore>()(
  temporal(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,

      // -----------------------------------------------------------------------
      createWorkspace(files) {
        const workspaceId = uuidv4();
        const sourceDocs: Record<string, SourceDoc> = {};
        const pages: WorkspacePage[] = [];

        for (const file of files) {
          const docId = uuidv4();
          sourceDocs[docId] = {
            id: docId,
            filePath: file.path,
            fileName: file.name,
            bytes: file.bytes,
            numPages: file.numPages,
          };
          pages.push(...buildPages(docId, file.numPages));
        }

        const title =
          files.length === 1
            ? files[0].name
            : `${files[0].name} + ${files.length - 1} more`;

        const workspace: Workspace = {
          id: workspaceId,
          title,
          pages,
          sourceDocs,
          isDirty: false,
        };

        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          activeWorkspaceId: workspaceId,
        }));

        setTimeout(() => {
          useWorkspaceStore.temporal.getState().clear();
        }, 0);

        return workspaceId;
      },

      // -----------------------------------------------------------------------
      closeWorkspace(id) {
        set((state) => {
          const remaining = state.workspaces.filter((ws) => ws.id !== id);
          const newActive =
            state.activeWorkspaceId === id
              ? (remaining[remaining.length - 1]?.id ?? null)
              : state.activeWorkspaceId;
          return { workspaces: remaining, activeWorkspaceId: newActive };
        });
      },

      setActiveWorkspace(id) {
        set({ activeWorkspaceId: id });
      },

      // -----------------------------------------------------------------------
      deletePage(workspaceId, pageId) {
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => ({
            pages: ws.pages.filter((p) => p.id !== pageId),
          })),
        }));
      },

      deletePages(workspaceId, pageIds) {
        const toDelete = new Set(pageIds);
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => ({
            pages: ws.pages.filter((p) => !toDelete.has(p.id)),
          })),
        }));
      },

      rotatePage(workspaceId, pageId, direction) {
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => ({
            pages: ws.pages.map((p) =>
              p.id === pageId
                ? { ...p, rotation: rotationStep(p.rotation, direction) }
                : p
            ),
          })),
        }));
      },

      rotatePages(workspaceId, pageIds, direction) {
        const toRotate = new Set(pageIds);
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => ({
            pages: ws.pages.map((p) =>
              toRotate.has(p.id)
                ? { ...p, rotation: rotationStep(p.rotation, direction) }
                : p
            ),
          })),
        }));
      },

      reorderPages(workspaceId, fromIndex, toIndex) {
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => {
            const pages = [...ws.pages];
            const [moved] = pages.splice(fromIndex, 1);
            pages.splice(toIndex, 0, moved);
            return { pages };
          }),
        }));
      },

      // -----------------------------------------------------------------------
      mergePdfs(workspaceId, files) {
        set((state) => ({
          workspaces: updateWorkspace(state.workspaces, workspaceId, (ws) => {
            const newSourceDocs = { ...ws.sourceDocs };
            const newPages = [...ws.pages];

            for (const file of files) {
              const docId = uuidv4();
              newSourceDocs[docId] = {
                id: docId,
                filePath: file.path,
                fileName: file.name,
                bytes: file.bytes,
                numPages: file.numPages,
              };
              newPages.push(...buildPages(docId, file.numPages));
            }

            return { sourceDocs: newSourceDocs, pages: newPages };
          }),
        }));
      },

      splitWorkspace(workspaceId, afterPageIndex) {
        const { workspaces } = get();
        const ws = workspaces.find((w) => w.id === workspaceId);
        if (!ws) return;

        const part1Pages = ws.pages.slice(0, afterPageIndex + 1);
        const part2Pages = ws.pages.slice(afterPageIndex + 1);
        if (part2Pages.length === 0) return;

        const newId = uuidv4();

        // Assign new stable IDs to the cloned pages
        const rebuildIds = (pages: WorkspacePage[]) =>
          pages.map((p) => ({ ...p, id: uuidv4() }));

        set((state) => ({
          workspaces: [
            ...state.workspaces.map((w) =>
              w.id === workspaceId
                ? { ...w, pages: rebuildIds(part1Pages), isDirty: true }
                : w
            ),
            {
              id: newId,
              title: `${ws.title} (split)`,
              pages: rebuildIds(part2Pages),
              sourceDocs: ws.sourceDocs, // shared reference — bytes not copied
              isDirty: true,
            },
          ],
          activeWorkspaceId: newId,
        }));
      },

      markSaved(workspaceId) {
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, isDirty: false } : ws
          ),
        }));
      },
    }),
    {
      // Only track page/workspace mutations in undo history, not UI state
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      limit: 50,
    }
  )
);

// Convenience selector hooks
export const useActiveWorkspace = (): Workspace | undefined => {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  return workspaces.find((ws) => ws.id === activeWorkspaceId);
};
