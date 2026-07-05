import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { pdfjs } from "@/lib/pdf/pdfWorker";
import { useActiveWorkspace } from "@/store/workspaceStore";

interface PdfToImagesToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function PdfToImagesTool(_props: PdfToImagesToolProps) {
  const [inputPath, setInputPath] = useState<string>("");
  const [targetDir, setTargetDir] = useState<string>("");
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [dpi, setDpi] = useState<number>(150);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [pagesConverted, setPagesConverted] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

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

  async function handlePickDir() {
    try {
      const dir = await open({
        directory: true,
        multiple: false,
      });
      if (typeof dir === "string") {
        setTargetDir(dir);
        setStatus("idle");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConvert() {
    if (!inputPath || !targetDir) return;

    try {
      setStatus("running");
      setProgress(5);
      setErrorMsg("");
      setPagesConverted(0);

      // Read PDF bytes
      const fileBytes = await readFile(inputPath);
      const loadingTask = pdfjs.getDocument({ data: fileBytes });
      const pdfDoc = await loadingTask.promise;
      const total = pdfDoc.numPages;
      setTotalPages(total);
      
      setProgress(15);
      
      const sep = targetDir.includes("/") ? "/" : "\\";
      const scale = dpi / 72; // Standard PDF DPI is 72

      for (let pageNum = 1; pageNum <= total; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D canvas context.");

        // Render page to canvas
        await page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
          canvas: canvas as any,
        }).promise;

        // Convert canvas to blob
        const mimeType = format === "png" ? "image/png" : "image/jpeg";
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), mimeType, 0.95)
        );

        if (!blob) throw new Error(`Could not generate image for page ${pageNum}`);

        // Write file
        const arrayBuffer = await blob.arrayBuffer();
        const imgBytes = new Uint8Array(arrayBuffer);
        const imgPath = `${targetDir}${sep}page_${pageNum}.${format}`;
        await writeFile(imgPath, imgBytes);

        setPagesConverted(pageNum);
        const currentProgress = 15 + Math.round((pageNum / total) * 85);
        setProgress(currentProgress);
      }

      setStatus("success");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        Convert each page of a PDF document into an individual image file.
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

      {/* Directory Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Output Directory
        </label>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm truncate">
            {targetDir || "No folder selected..."}
          </div>
          <Button variant="outline" size="sm" onClick={handlePickDir}>
            Choose Folder
          </Button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Format Select */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Image Format
          </label>
          <div className="flex rounded-lg border border-border overflow-hidden bg-background h-9">
            <button
              onClick={() => setFormat("png")}
              className={`flex-1 text-sm font-medium transition-all cursor-pointer ${
                format === "png"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground bg-card"
              }`}
            >
              PNG
            </button>
            <button
              onClick={() => setFormat("jpeg")}
              className={`flex-1 text-sm font-medium transition-all cursor-pointer border-l border-border ${
                format === "jpeg"
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground bg-card"
              }`}
            >
              JPEG
            </button>
          </div>
        </div>

        {/* DPI Select */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Resolution (DPI)
          </label>
          <div className="flex rounded-lg border border-border overflow-hidden bg-background h-9">
            {[72, 150, 300].map((d) => (
              <button
                key={d}
                onClick={() => setDpi(d)}
                className={`flex-1 text-sm font-medium transition-all cursor-pointer border-r last:border-r-0 border-border ${
                  dpi === d
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "hover:bg-accent hover:text-accent-foreground text-muted-foreground bg-card"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleConvert}
        disabled={!inputPath || !targetDir || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Converting..." : "Convert PDF to Images"}
      </Button>

      {/* Progress Indicator */}
      {status === "running" && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full relative">
            <div
              className="absolute top-0 bottom-0 left-0 bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-center text-muted-foreground flex justify-between px-1">
            <span>Progress: {progress}%</span>
            <span>Converted: {pagesConverted} / {totalPages} pages</span>
          </div>
        </div>
      )}

      {/* Success View */}
      {status === "success" && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>✓</span> {pagesConverted} pages converted successfully!
          </div>
          <div className="text-xs truncate opacity-90">
            Saved to folder: {targetDir}
          </div>
        </div>
      )}

      {/* Error View */}
      {status === "error" && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠</span> Conversion failed
          </div>
          <div className="text-xs leading-relaxed opacity-90">
            {errorMsg}
          </div>
        </div>
      )}
    </div>
  );
}
