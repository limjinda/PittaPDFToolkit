import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PDFDocument } from "pdf-lib";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";

interface ImageItem {
  path: string;
  name: string;
}

interface ImageToPdfToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function ImageToPdfTool({ onViewChange }: ImageToPdfToolProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [savedPath, setSavedPath] = useState<string>("");

  useEffect(() => {
    const handler = (e: any) => {
      const paths: string[] = e.detail;
      const newItems = paths.map((p) => {
        const sep = p.includes("/") ? "/" : "\\";
        const name = p.substring(p.lastIndexOf(sep) + 1);
        return { path: p, name };
      });
      setImages((prev) => [...prev, ...newItems]);
    };
    window.addEventListener("handle-dropped-images", handler);
    return () => window.removeEventListener("handle-dropped-images", handler);
  }, []);

  async function handleAddImages() {
    try {
      const selected = await open({
        filters: [{ name: "Image Files", extensions: ["png", "jpg", "jpeg"] }],
        multiple: true,
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      const newItems = paths.map((p) => {
        const sep = p.includes("/") ? "/" : "\\";
        const name = p.substring(p.lastIndexOf(sep) + 1);
        return { path: p, name };
      });

      setImages((prev) => [...prev, ...newItems]);
      setStatus("idle");
    } catch (err) {
      console.error(err);
    }
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setStatus("idle");
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setImages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  }

  function handleMoveDown(index: number) {
    if (index === images.length - 1) return;
    setImages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  }

  async function handleConvert() {
    if (images.length === 0) return;

    try {
      const outPath = await save({
        title: "Save PDF",
        defaultPath: "converted_images.pdf",
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
      });

      if (!outPath) return;

      setStatus("running");
      setProgress(5);
      setErrorMsg("");

      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const bytes = await readFile(item.path);

        const isPngBytes = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
        const isJpgBytes = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

        let img;
        if (isPngBytes) {
          img = await pdfDoc.embedPng(bytes);
        } else if (isJpgBytes) {
          img = await pdfDoc.embedJpg(bytes);
        } else {
          // If neither, fallback to try catch or throw error
          try {
            img = await pdfDoc.embedPng(bytes);
          } catch {
            try {
              img = await pdfDoc.embedJpg(bytes);
            } catch {
              throw new Error(`File ${item.name} is not a valid PNG or JPEG image.`);
            }
          }
        }

        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });

        const currentProgress = 5 + Math.round(((i + 1) / images.length) * 85);
        setProgress(currentProgress);
      }

      const outBytes = await pdfDoc.save();
      await writeFile(outPath, outBytes);

      setProgress(100);
      setSavedPath(outPath);
      setStatus("success");

      // Auto-open in new tab
      try {
        const doc = await loadPdfDoc(outPath, outBytes);
        useWorkspaceStore.getState().createWorkspace([{
          path: outPath,
          name: outPath.split(/[\\/]/).pop() || "converted_images.pdf",
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
        Convert one or more image files (PNG, JPG, JPEG) into a single PDF document.
      </div>

      {/* Image List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Image Files
          </label>
          <Button variant="outline" size="sm" onClick={handleAddImages}>
            + Add Images
          </Button>
        </div>

        {images.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground bg-muted/10">
            No images added. Click "+ Add Images" to get started.
          </div>
        ) : (
          <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border bg-background">
            {images.map((item, idx) => (
              <div key={`${item.path}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground font-mono text-xs w-5">{idx + 1}.</span>
                  <span className="truncate font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="w-7 h-7"
                    title="Move Up"
                  >
                    ▲
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === images.length - 1}
                    className="w-7 h-7"
                    title="Move Down"
                  >
                    ▼
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveImage(idx)}
                    className="w-7 h-7 text-destructive hover:bg-destructive/10"
                    title="Remove"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Button */}
      <Button
        onClick={handleConvert}
        disabled={images.length === 0 || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Converting..." : "Convert to PDF"}
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
          <div className="text-xs text-center text-muted-foreground">
            Embedding images into PDF... {progress}%
          </div>
        </div>
      )}

      {/* Success View */}
      {status === "success" && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>✓</span> PDF compiled successfully!
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
