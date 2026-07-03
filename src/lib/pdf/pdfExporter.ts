import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Workspace, SourceDoc } from "@/store/workspaceStore";
import type { Annotation } from "@/features/annotation/model/annotationTypes";

// ── Colour helper ──────────────────────────────────────────────────────────────

/**
 * Converts a CSS hex colour string ("#rrggbb") to pdf-lib's [r, g, b] tuple
 * with each channel normalised to the 0–1 range.
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// ── Annotation burn-in ─────────────────────────────────────────────────────────

/**
 * Draws all annotations for one page onto a pdf-lib PDFPage.
 *
 * PDF coordinate origin is bottom-left; annotations store fractions from
 * top-left, so the Y axis is flipped: pdfY = pageHeight − (fraction × pageHeight).
 *
 * @param pdfPage   - The pdf-lib page to draw onto.
 * @param anns      - Annotations to render (for this page only).
 * @param pageW     - PDF page width in pt.
 * @param pageH     - PDF page height in pt.
 * @param bodyFont  - Embedded Helvetica font for text annotations.
 */
async function burnAnnotations(
  pdfPage: PDFPage,
  anns: Annotation[],
  pageW: number,
  pageH: number,
  bodyFont: Awaited<ReturnType<PDFDocument["embedFont"]>>
): Promise<void> {
  for (const ann of anns) {
    if (ann.kind === "highlight") {
      const [r, g, b] = hexToRgb(ann.color);
      pdfPage.drawRectangle({
        x: ann.x * pageW,
        // PDF y origin is bottom-left; shift up by the highlight height
        y: pageH - (ann.y + ann.height) * pageH,
        width: ann.width * pageW,
        height: ann.height * pageH,
        color: rgb(r, g, b),
        opacity: ann.opacity,
      });
    } else if (ann.kind === "text" && ann.content.trim().length > 0) {
      const [r, g, b] = hexToRgb(ann.color);
      pdfPage.drawText(ann.content, {
        x: ann.x * pageW,
        y: pageH - ann.y * pageH - ann.fontSize,
        size: ann.fontSize,
        font: bodyFont,
        color: rgb(r, g, b),
      });
    } else if (ann.kind === "checkmark") {
      const [r, g, b] = hexToRgb(ann.color);
      const size = ann.size * pageW;
      const cx = ann.x * pageW;
      const cy = pageH - ann.y * pageH;
      const thickness = Math.max(1, size * 0.12);
      const colour = rgb(r, g, b);
      // Draw checkmark as two connected line segments: short down-left stroke + long up-right stroke
      pdfPage.drawLine({ start: { x: cx,                y: cy - size * 0.3 }, end: { x: cx + size * 0.35, y: cy - size * 0.65 }, thickness, color: colour });
      pdfPage.drawLine({ start: { x: cx + size * 0.35, y: cy - size * 0.65 }, end: { x: cx + size,        y: cy + size * 0.1  }, thickness, color: colour });
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Builds a new PDF from a Workspace's page list, applies user rotations,
 * and burns all annotations into the page content before saving.
 *
 * @param workspace       - The workspace describing page order and rotations.
 * @param sourceDocs      - Raw PDF bytes keyed by sourceDocId.
 * @param annotationsByPage - Annotations keyed by WorkspacePage.id (defaults to empty).
 * @returns Raw bytes of the exported PDF.
 */
export async function exportWorkspace(
  workspace: Workspace,
  sourceDocs: Record<string, SourceDoc>,
  annotationsByPage: Record<string, Annotation[]> = {},
  fontBytes: Uint8Array | null = null
): Promise<Uint8Array> {
  const outputDoc = await PDFDocument.create();
  outputDoc.registerFontkit(fontkit);
  
  let bodyFont;
  if (fontBytes) {
    try {
      bodyFont = await outputDoc.embedFont(fontBytes);
    } catch (e) {
      console.warn("Failed to embed custom system font, falling back to Helvetica:", e);
      bodyFont = await outputDoc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    bodyFont = await outputDoc.embedFont(StandardFonts.Helvetica);
  }

  // Cache loaded pdf-lib docs per sourceDocId to avoid re-parsing
  const libDocCache = new Map<string, PDFDocument>();

  for (const workspacePage of workspace.pages) {
    const sourceDoc = sourceDocs[workspacePage.sourceDocId];
    if (!sourceDoc) continue;

    let libDoc = libDocCache.get(workspacePage.sourceDocId);
    if (!libDoc) {
      libDoc = await PDFDocument.load(sourceDoc.bytes, { ignoreEncryption: true });
      libDocCache.set(workspacePage.sourceDocId, libDoc);
    }

    const [copiedPage] = await outputDoc.copyPages(libDoc, [workspacePage.sourcePageIndex]);

    // Apply user rotation on top of the source page's existing rotation
    const existingRotation = copiedPage.getRotation().angle;
    copiedPage.setRotation(degrees((existingRotation + workspacePage.rotation) % 360));

    outputDoc.addPage(copiedPage);

    // Burn annotations after the page is added
    const annotations = annotationsByPage[workspacePage.id] ?? [];
    if (annotations.length > 0) {
      const { width, height } = copiedPage.getSize();
      await burnAnnotations(copiedPage, annotations, width, height, bodyFont);
    }
  }

  return outputDoc.save();
}
