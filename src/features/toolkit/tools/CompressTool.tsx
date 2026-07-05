import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { readFile } from "@tauri-apps/plugin-fs";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

interface CompressToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function CompressTool({ onViewChange }: CompressToolProps) {
  const [inputPath, setInputPath] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [savedPath, setSavedPath] = useState<string>("");
  const [progressMsg, setProgressMsg] = useState<string>("");

  const activeWorkspace = useActiveWorkspace();

  useEffect(() => {
    if (activeWorkspace) {
      const docs = Object.values(activeWorkspace.sourceDocs);
      if (docs.length > 0) {
        setInputPath(docs[0].filePath);
      }
    }
  }, [activeWorkspace]);

  async function handlePickFile() {
    try {
      const file = await open({
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        multiple: false,
      });
      if (typeof file === "string") {
        setInputPath(file);
        setStatus("idle");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCompress() {
    if (!inputPath) return;

    try {
      const outPath = await save({
        title: "Save Compressed PDF",
        defaultPath: inputPath.replace(/\.pdf$/i, "") + "_compressed.pdf",
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (!outPath) return;

      setStatus("running");
      setErrorMsg("");
      
      setProgressMsg("Compressing PDF via Ghostscript... Please do not close the app.");

      // Run compression via backend
      await invoke("compress_pdf", {
        inputPath: inputPath,
        outputPath: outPath,
        quality: "max"
      });

      setSavedPath(outPath);
      setStatus("success");

      // Auto-open in new tab
      try {
        const bytes = await readFile(outPath);
        const doc = await loadPdfDoc(outPath, bytes);
        useWorkspaceStore.getState().createWorkspace([{
          path: outPath,
          name: outPath.split(/[\\/]/).pop() || "compressed.pdf",
          bytes,
          numPages: doc.numPages
        }]);
        if (onViewChange) onViewChange("viewer");
      } catch (err) {
        console.error("Failed to auto-open compressed PDF:", err);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        Reduce the file size of your PDF while maintaining image quality using a secure, offline JS engine.
      </div>

      {/* File Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Select PDF File
        </label>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm truncate">
            {inputPath || "No file selected..."}
          </div>
          <Button variant="outline" size="sm" onClick={handlePickFile}>
            Browse
          </Button>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleCompress}
        disabled={!inputPath || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Compressing..." : "Compress PDF"}
      </Button>

      {/* Progress Indicator */}
      {status === "running" && (
        <div className="flex flex-col gap-2 animate-pulse">
          <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full relative">
            <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-primary rounded-full animate-[loading_1.5s_infinite_linear]" style={{
              animationName: "loading",
              animationDuration: "1.5s",
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
            }} />
          </div>
          <div className="text-xs text-center text-muted-foreground">
            {progressMsg}
          </div>
          <style>{`
            @keyframes loading {
              0% { left: -30%; width: 30%; }
              50% { width: 40%; }
              100% { left: 100%; width: 30%; }
            }
          `}</style>
        </div>
      )}

      {/* Success View */}
      {status === "success" && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>✓</span> PDF compressed successfully!
          </div>
          <div className="text-xs truncate opacity-90">
            Saved to: {savedPath}
          </div>
        </div>
      )}

      {/* Error View */}
      {status === "error" && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠</span> Compression failed
          </div>
          <div className="text-xs leading-relaxed opacity-90">
            {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
}
