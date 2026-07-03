import { useAnnotationStore, type AnnotationTool } from "@/store/annotationStore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolButton {
  tool: AnnotationTool;
  label: string;
  shortcut: string;
  icon: string;
}

const TOOLS: ToolButton[] = [
  { tool: "select",    icon: "↖",  label: "Select / Move",  shortcut: "V" },
  { tool: "text",      icon: "T",  label: "Add text",        shortcut: "T" },
  { tool: "checkmark", icon: "✓",  label: "Add checkmark",   shortcut: "K" },
  { tool: "highlight", icon: "▬",  label: "Highlight",       shortcut: "H" },
];

/**
 * Vertical strip of annotation tool toggle buttons.
 * Rendered between the thumbnail sidebar and the viewer pane.
 * Only visible when a document is open in viewer mode.
 */
export function AnnotationToolbar() {
  const { activeTool, setTool } = useAnnotationStore();

  return (
    <div
      className="flex flex-col items-center gap-1 py-2 px-1 border-r border-border bg-card shrink-0"
      style={{ width: 40 }}
    >
      {TOOLS.map(({ tool, icon, label, shortcut }) => {
        const isActive = activeTool === tool;
        return (
          <Tooltip key={tool}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTool(tool)}
                aria-label={label}
                aria-pressed={isActive}
                style={{ transition: "background 100ms, color 100ms" }}
                className={[
                  "w-7 h-7 flex items-center justify-center rounded text-sm font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">
                {label} <span className="opacity-50">({shortcut})</span>
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
