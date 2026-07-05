import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PDFDocument } from "pdf-lib";
import { useActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

interface ExtractPagesToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function ExtractPagesTool({ onViewChange }: ExtractPagesToolProps) {
  const [inputPath, setInputPath] = useState<string>("");
  const [pageRanges, setPageRanges] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [savedPath, setSavedPath] = useState<string>("");

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

  async function handleExtract() {
    if (!inputPath || !pageRanges) return;

    try {
      const outPath = await save({
        title: "Save Extracted PDF",
        defaultPath: inputPath.replace(/\.pdf$/i, "") + "_extracted.pdf",
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (!outPath) return;

      setStatus("running");
      setErrorMsg("");

      // Read source file bytes
      const fileBytes = await readFile(inputPath);
      const srcDoc = await PDFDocument.load(fileBytes);
      const newDoc = await PDFDocument.create();
      
      const pageIndices: number[] = [];
      const totalPages = srcDoc.getPageCount();
      
      // Parse range string (e.g. "1-3, 5")
      const parts = pageRanges.split(",");
      for (const part of parts) {
        const cleanPart = part.trim();
        if (cleanPart.includes("-")) {
          const [startStr, endStr] = cleanPart.split("-");
          const start = parseInt(startStr.trim(), 10);
          const end = parseInt(endStr.trim(), 10);
          if (!isNaN(start) && !isNaN(end)) {
            const s = Math.max(1, Math.min(start, totalPages));
            const e = Math.max(1, Math.min(end, totalPages));
            const min = Math.min(s, e);
            const max = Math.max(s, e);
            for (let i = min; i <= max; i++) {
              pageIndices.push(i - 1);
            }
          }
        } else {
          const pageNum = parseInt(cleanPart, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            pageIndices.push(pageNum - 1);
          }
        }
      }
      
      if (pageIndices.length === 0) {
        throw new Error(`No valid pages specified. Document only has ${totalPages} pages.`);
      }

      // Copy pages
      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach((p) => newDoc.addPage(p));
      const outBytes = await newDoc.save();

      // Write output file
      await writeFile(outPath, outBytes);

      setSavedPath(outPath);
      setStatus("success");

      // Auto-open in new tab
      try {
        const doc = await loadPdfDoc(outPath, outBytes);
        useWorkspaceStore.getState().createWorkspace([{
          path: outPath,
          name: outPath.split(/[\\/]/).pop() || "extracted.pdf",
          bytes: outBytes,
          numPages: doc.numPages
        }]);
        if (onViewChange) onViewChange("viewer");
      } catch (err) {
        console.error("Failed to auto-open extracted PDF:", err);
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
        Extract specific pages from a PDF document to create a new file.
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

      {/* Page Range Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Page Ranges
        </label>
        <input
          type="text"
          value={pageRanges}
          onChange={(e) => setPageRanges(e.target.value)}
          placeholder="e.g. 1-3, 5, 7-10"
          className="px-3 py-2 border border-border rounded-lg bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
        />
        <span className="text-xxs text-muted-foreground/80 leading-normal">
          Specify page numbers separated by commas. Use hyphens for ranges. E.g. "1-3, 5, 8" extracts pages 1, 2, 3, 5, and 8.
        </span>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleExtract}
        disabled={!inputPath || !pageRanges.trim() || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Extracting..." : "Extract Pages"}
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
            Extracting pages... Please do not close the app.
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
            <span>✓</span> Pages extracted successfully!
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
            <span>⚠</span> Extraction failed
          </div>
          <div className="text-xs leading-relaxed opacity-90">
            {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
}
