import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUIStore } from "@/store/uiStore";

/**
 * Convenience hook that wraps page-level operations
 * for a given workspace ID, bound to the active workspace.
 */
export function usePageOps(workspaceId: string) {
  const {
    deletePage,
    deletePages,
    rotatePage,
    rotatePages,
    reorderPages,
    splitWorkspace,
  } = useWorkspaceStore();

  const { selectedPageIds, clearSelection } = useUIStore();

  return {
    deletePage: (pageId: string) => {
      deletePage(workspaceId, pageId);
      clearSelection();
    },

    deleteSelected: () => {
      if (selectedPageIds.size > 0) {
        deletePages(workspaceId, [...selectedPageIds]);
        clearSelection();
      }
    },

    rotatePage: (pageId: string, direction: "cw" | "ccw") => {
      rotatePage(workspaceId, pageId, direction);
    },

    rotateSelected: (direction: "cw" | "ccw") => {
      if (selectedPageIds.size > 0) {
        rotatePages(workspaceId, [...selectedPageIds], direction);
      }
    },

    reorderPages: (fromIndex: number, toIndex: number) => {
      reorderPages(workspaceId, fromIndex, toIndex);
    },

    splitAt: (afterPageIndex: number) => {
      splitWorkspace(workspaceId, afterPageIndex);
    },
  };
}
