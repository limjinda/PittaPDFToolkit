import { pdfjs } from "./pdfWorker";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Cache loaded pdf.js documents by source doc ID to avoid re-parsing
const docCache = new Map<string, PDFDocumentProxy>();

/**
 * Load a PDF from raw bytes using pdf.js.
 * Caches the result by docId — same bytes won't be re-parsed.
 */
export async function loadPdfDoc(
  docId: string,
  bytes: Uint8Array
): Promise<PDFDocumentProxy> {
  if (docCache.has(docId)) {
    return docCache.get(docId)!;
  }

  const data = new Uint8Array(bytes);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  docCache.set(docId, doc);
  return doc;
}

/** Evict a document from cache */
export function evictPdfDoc(docId: string): void {
  docCache.delete(docId);
}

/** Clear all cached documents */
export function clearPdfCache(): void {
  docCache.clear();
}
