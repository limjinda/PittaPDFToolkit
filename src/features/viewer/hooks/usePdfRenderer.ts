import { useEffect, useRef, useCallback } from "react";
import { loadPdfDoc } from "@/lib/pdf/pdfLoader";
import type { WorkspacePage, SourceDoc } from "@/store/workspaceStore";

interface UsePdfRendererOptions {
  page: WorkspacePage;
  sourceDocs: Record<string, SourceDoc>;
  scale: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * Renders a single WorkspacePage onto a <canvas> element using pdf.js.
 * Automatically re-renders when scale or rotation changes.
 */
export function usePdfRenderer({
  page,
  sourceDocs,
  scale,
  canvasRef,
}: UsePdfRendererOptions) {
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sourceDoc = sourceDocs[page.sourceDocId];
    if (!sourceDoc) return;

    try {
      const pdfDoc = await loadPdfDoc(page.sourceDocId, sourceDoc.bytes);
      const pdfPage = await pdfDoc.getPage(page.sourcePageIndex + 1); // pdf.js is 1-indexed

      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      // Account for rotation: pdf.js handles the original page rotation;
      // we add our user-applied rotation on top.
      const userRotation = page.rotation;
      const viewport = pdfPage.getViewport({ scale, rotation: userRotation });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const renderTask = pdfPage.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvas: canvas as any,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: unknown) {
      // RenderingCancelledException is expected when we cancel — ignore it
      if (err instanceof Error && err.name === "RenderingCancelledException") return;
      console.error("PDF render error:", err);
    }
  }, [page, sourceDocs, scale, canvasRef]);

  useEffect(() => {
    render();
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [render]);
}
