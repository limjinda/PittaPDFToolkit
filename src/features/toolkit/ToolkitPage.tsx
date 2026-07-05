import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import { CompressTool } from "./tools/CompressTool";
import { ExtractPagesTool } from "./tools/ExtractPagesTool";
import { ExtractImagesTool } from "./tools/ExtractImagesTool";
import { ImageToPdfTool } from "./tools/ImageToPdfTool";
import { PdfToImagesTool } from "./tools/PdfToImagesTool";
import { EncryptTool } from "./tools/EncryptTool";
import { DecryptTool } from "./tools/DecryptTool";
import { MetadataTool } from "./tools/MetadataTool";

type ToolType =
  | null
  | "compress"
  | "extract-pages"
  | "extract-images"
  | "image-to-pdf"
  | "pdf-to-images"
  | "encrypt"
  | "decrypt"
  | "metadata";

interface ToolkitPageProps {
  onViewChange: (v: "viewer" | "grid" | "toolkit") => void;
}

export function ToolkitPage({ onViewChange }: ToolkitPageProps) {
  const [activeTool, setActiveTool] = useState<ToolType>(null);

  useEffect(() => {
    const handleOpenTool = (e: any) => {
      if (e.detail) setActiveTool(e.detail);
    };
    window.addEventListener("open-tool", handleOpenTool);
    return () => window.removeEventListener("open-tool", handleOpenTool);
  }, []);

  const tools = [
    {
      id: "compress" as const,
      title: "Compress PDF",
      description: "Reduce PDF file size using local compression algorithms.",
      icon: "🗜️",
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:border-blue-500/50",
    },
    {
      id: "extract-pages" as const,
      title: "Extract Pages",
      description: "Extract specific page ranges (e.g. 1-3, 5) into a new PDF document.",
      icon: "✂️",
      color: "from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/50",
    },
    {
      id: "extract-images" as const,
      title: "Extract Images",
      description: "Extract all embedded raster images (JPEG/PNG) from a PDF file.",
      icon: "🖼️",
      color: "from-purple-500/10 to-fuchsia-500/10 border-purple-500/20 hover:border-purple-500/50",
    },
    {
      id: "image-to-pdf" as const,
      title: "Image to PDF",
      description: "Convert PNG, JPG, and other image files into a single structured PDF.",
      icon: "📸",
      color: "from-rose-500/10 to-pink-500/10 border-rose-500/20 hover:border-rose-500/50",
    },
    {
      id: "pdf-to-images" as const,
      title: "PDF to Images",
      description: "Convert each page of a PDF file into high-resolution PNG or JPG images.",
      icon: "🎨",
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/50",
    },
    {
      id: "encrypt" as const,
      title: "Protect PDF",
      description: "Encrypt your PDF with user and owner passwords for secure distribution.",
      icon: "🔒",
      color: "from-teal-500/10 to-cyan-500/10 border-teal-500/20 hover:border-teal-500/50",
    },
    {
      id: "decrypt" as const,
      title: "Unlock PDF",
      description: "Remove password protection from a PDF document (password required).",
      icon: "🔓",
      color: "from-yellow-500/10 to-amber-500/10 border-yellow-500/20 hover:border-yellow-500/50",
    },
    {
      id: "metadata" as const,
      title: "Edit Metadata",
      description: "Inspect and update PDF title, author, subject, keywords, and creators.",
      icon: "📝",
      color: "from-sky-500/10 to-blue-500/10 border-sky-500/20 hover:border-sky-500/50",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 flex flex-col items-center">
      {activeTool ? (
        <div className="w-full max-w-3xl flex flex-col">
          {/* Back Header */}
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTool(null)}
              className="gap-1.5"
            >
              ← Back to Tools
            </Button>
            <h2 className="text-xl font-bold tracking-tight">
              {tools.find((t) => t.id === activeTool)?.title}
            </h2>
          </div>

          {/* Tool Area */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            {activeTool === "compress" && <CompressTool onViewChange={onViewChange} />}
            {activeTool === "extract-pages" && <ExtractPagesTool onViewChange={onViewChange} />}
            {activeTool === "extract-images" && <ExtractImagesTool onViewChange={onViewChange} />}
            {activeTool === "image-to-pdf" && <ImageToPdfTool onViewChange={onViewChange} />}
            {activeTool === "pdf-to-images" && <PdfToImagesTool onViewChange={onViewChange} />}
            {activeTool === "encrypt" && <EncryptTool onViewChange={onViewChange} />}
            {activeTool === "decrypt" && <DecryptTool onViewChange={onViewChange} />}
            {activeTool === "metadata" && <MetadataTool onViewChange={onViewChange} />}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">PDF Toolkit</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Fast, 100% offline utilities. None of your data ever leaves this computer.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onViewChange("viewer")}>
              Go to Workspace →
            </Button>
          </div>

          {/* Grid Menu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-start gap-4 p-5 rounded-xl border bg-gradient-to-br ${tool.color} text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer`}
              >
                <span className="text-3xl p-2 rounded-lg bg-background border border-border shadow-sm shrink-0">
                  {tool.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tool.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
