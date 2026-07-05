import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PDFDocument, PDFRawStream, PDFName } from "pdf-lib";
import { useActiveWorkspace } from "@/store/workspaceStore";

interface ExtractImagesToolProps {
  onViewChange?: (v: "viewer" | "grid" | "toolkit") => void;
}

export function ExtractImagesTool(_props: ExtractImagesToolProps) {
  const [inputPath, setInputPath] = useState<string>("");
  const [targetDir, setTargetDir] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [imagesExtracted, setImagesExtracted] = useState<number>(0);

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

  async function handleExtract() {
    if (!inputPath || !targetDir) return;

    try {
      setStatus("running");
      setProgress(5);
      setErrorMsg("");
      setImagesExtracted(0);

      // Read PDF bytes
      const fileBytes = await readFile(inputPath);
      const pdfDoc = await PDFDocument.load(fileBytes);
      
      setProgress(15);
      
      const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
      const imageObjects: { bytes: Uint8Array; extension: string }[] = [];

      for (const [_, pdfObject] of indirectObjects) {
        if (pdfObject instanceof PDFRawStream) {
          const dict = pdfObject.dict;
          const subtype = dict.get(PDFName.of("Subtype"));
          if (subtype === PDFName.of("Image")) {
            const filter = dict.get(PDFName.of("Filter"));
            let extension = "png";
            
            // Check if DCTDecode (JPEG compression)
            if (
              filter === PDFName.of("DCTDecode") ||
              (filter instanceof PDFName && filter.toString() === "/DCTDecode") ||
              (Array.isArray(filter) && filter.some(f => f.toString() === "/DCTDecode"))
            ) {
              extension = "jpg";
            }
            
            imageObjects.push({
              bytes: pdfObject.contents,
              extension,
            });
          }
        }
      }

      if (imageObjects.length === 0) {
        throw new Error("No embedded images found in this PDF document.");
      }

      setProgress(30);

      const sep = targetDir.includes("/") ? "/" : "\\";
      let count = 0;

      for (let i = 0; i < imageObjects.length; i++) {
        const img = imageObjects[i];
        const imgPath = `${targetDir}${sep}extracted_img_${i + 1}.${img.extension}`;
        
        await writeFile(imgPath, img.bytes);
        count++;
        setImagesExtracted(count);
        
        // Calculate progress between 30% and 100%
        const currentProgress = 30 + Math.round((count / imageObjects.length) * 70);
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
        Extract all embedded raster images (JPEG/PNG) from a PDF file and save them to a local directory.
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

      {/* Action Button */}
      <Button
        onClick={handleExtract}
        disabled={!inputPath || !targetDir || status === "running"}
        className="w-full"
      >
        {status === "running" ? "Extracting..." : "Extract Images"}
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
            <span>Extracted: {imagesExtracted} images</span>
          </div>
        </div>
      )}

      {/* Success View */}
      {status === "success" && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <span>✓</span> {imagesExtracted} images extracted successfully!
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
