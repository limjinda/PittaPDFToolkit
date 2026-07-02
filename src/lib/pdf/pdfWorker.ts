/**
 * pdf.js worker setup for Vite
 * Must be imported before any pdfjs-dist usage.
 */
import * as pdfjs from "pdfjs-dist";

// Use the bundled worker from pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export { pdfjs };
