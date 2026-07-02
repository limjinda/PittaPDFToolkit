import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { workspaces, activeWorkspaceId, setActiveWorkspace, closeWorkspace } =
    useWorkspaceStore();

  if (workspaces.length === 0) return null;

  return (
    <div
      className="flex items-end gap-0 overflow-x-auto border-b border-border bg-card shrink-0 pl-1"
      style={{ height: "var(--tabbar-height)" }}
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <button
            key={ws.id}
            onClick={() => setActiveWorkspace(ws.id)}
            className={cn(
              "flex items-center gap-1.5 h-[34px] px-3 rounded-t-md text-xs font-medium",
              "border border-b-0 transition-all duration-150 max-w-[200px] shrink-0",
              "group relative",
              isActive
                ? "bg-background border-border text-foreground -mb-px"
                : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="truncate max-w-[140px]">{ws.title}</span>
            {ws.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                closeWorkspace(ws.id);
              }}
              className={cn(
                "ml-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                "text-muted-foreground hover:text-foreground hover:bg-destructive/20",
                "transition-all opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
