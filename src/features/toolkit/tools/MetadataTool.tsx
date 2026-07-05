import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PDFDocument } from "pdf-lib";
import { useActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

interface MetadataToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function MetadataTool({ onViewChange }: MetadataToolProps) {
  const [inputPath, setInputPath] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [creator, setCreator] = useState<string>("");
  const [producer, setProducer] = useState<string>("");

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [savedPath, setSavedPath] = useState<string>("");

  const activeWorkspace = useActiveWorkspace();

  async function loadMetadata(path: string) {
    try {
      setStatus("loading");
      setErrorMsg("");

      const fileBytes = await readFile(path);
      const pdfDoc = await PDFDocument.load(fileBytes);

      setTitle(pdfDoc.getTitle() || "");
      setAuthor(pdfDoc.getAuthor() || "");
      setSubject(pdfDoc.getSubject() || "");
      setKeywords(pdfDoc.getKeywords() || "");
      setCreator(pdfDoc.getCreator() || "");
      setProducer(pdfDoc.getProducer() || "");

      setStatus("idle");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  useEffect(() => {
    if (activeWorkspace) {
      const docs = Object.values(activeWorkspace.sourceDocs);
      if (docs.length > 0) {
        const path = docs[0].filePath;
        setInputPath(path);
        loadMetadata(path);
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
        loadMetadata(file);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveMetadata() {
    if (!inputPath) return;

    try {
      const outPath = await save({
        title: "Save PDF with Metadata",
        defaultPath: inputPath.replace(/\.pdf$/i, "") + "_metadata.pdf",
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (!outPath) return;

      setStatus("running");
      setErrorMsg("");

      // Read source file bytes
      const fileBytes = await readFile(inputPath);
      const pdfDoc = await PDFDocument.load(fileBytes);

      // Set metadata
      pdfDoc.setTitle(title);
      pdfDoc.setAuthor(author);
      pdfDoc.setSubject(subject);
      pdfDoc.setKeywords(keywords.split(",").map((k) => k.trim()).filter((k) => k.length > 0));
      pdfDoc.setCreator(creator);
      pdfDoc.setProducer(producer);

      const outBytes = await pdfDoc.save();
      await writeFile(outPath, outBytes);

      setSavedPath(outPath);
      setStatus("success");

      // Auto-open in new tab
      try {
        const doc = await loadPdfDoc(outPath, outBytes);
        useWorkspaceStore.getState().createWorkspace([{
          path: outPath,
          name: outPath.split(/[\\/]/).pop() || "metadata.pdf",
          bytes: outBytes,
          numPages: doc.numPages
        }]);
        if (onViewChange) onViewChange("viewer");
      } catch (err) {
        console.error("Failed to auto-open PDF:", err);
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
        Inspect and update the metadata information embedded inside a PDF file.
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
          <Button variant="outline" size="sm" onClick={handlePickFile} disabled={status === "loading" || status === "running"}>
            {status === "loading" ? "Reading..." : "Browse"}
          </Button>
        </div>
      </div>

      {inputPath && status !== "loading" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Report"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Author */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. John Doe"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Monthly Business Overview"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Keywords */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. report, business, monthly"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Creator */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Creator / Application</label>
            <input
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="e.g. Microsoft Word"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Producer */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Producer / PDF Engine</label>
            <input
              type="text"
              value={producer}
              onChange={(e) => setProducer(e.target.value)}
              placeholder="e.g. Adobe PDF Library"
              className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSaveMetadata}
        disabled={!inputPath || status === "loading" || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Saving..." : "Save Metadata"}
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
            Updating PDF metadata... Please do not close the app.
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
            <span>✓</span> Metadata updated successfully!
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
            <span>⚠</span> Operation failed
          </div>
          <div className="text-xs leading-relaxed opacity-90">
            {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
}
