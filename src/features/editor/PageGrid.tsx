import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { PageGridItem } from "./PageGridItem";
import { usePageOps } from "./hooks/usePageOps";
import { useUIStore } from "@/store/uiStore";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";

interface PageGridProps {
  workspaceId: string;
  pages: WorkspacePage[];
  sourceDocs: Record<string, SourceDoc>;
}

export function PageGrid({ workspaceId, pages, sourceDocs }: PageGridProps) {
  const { selectedPageIds, selectPage } = useUIStore();
  const ops = usePageOps(workspaceId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = pages.findIndex((p) => p.id === active.id);
    const toIndex = pages.findIndex((p) => p.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      ops.reorderPages(fromIndex, toIndex);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No pages
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            }}
          >
            {pages.map((page, idx) => (
              <PageGridItem
                key={page.id}
                page={page}
                sourceDocs={sourceDocs}
                pageNumber={idx + 1}
                isSelected={selectedPageIds.has(page.id)}
                onSelect={selectPage}
                onRotateCW={(id) => ops.rotatePage(id, "cw")}
                onRotateCCW={(id) => ops.rotatePage(id, "ccw")}
                onDelete={ops.deletePage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
