import { PDFDocument, degrees } from "pdf-lib";
import type { Workspace, SourceDoc } from "@/store/workspaceStore";

/**
 * Build a new PDF from a Workspace's page list using pdf-lib.
 *
 * Each WorkspacePage is a reference to a source doc + page index + rotation.
 * We copy those pages (with rotation applied) into a fresh PDF document.
 */
export async function exportWorkspace(
  workspace: Workspace,
  sourceDocs: Record<string, SourceDoc>
): Promise<Uint8Array> {
  const outputDoc = await PDFDocument.create();

  // Cache loaded pdf-lib docs per sourceDocId to avoid re-parsing
  const libDocCache = new Map<string, PDFDocument>();

  for (const workspacePage of workspace.pages) {
    const sourceDoc = sourceDocs[workspacePage.sourceDocId];
    if (!sourceDoc) continue;

    let libDoc = libDocCache.get(workspacePage.sourceDocId);
    if (!libDoc) {
      libDoc = await PDFDocument.load(sourceDoc.bytes, {
        ignoreEncryption: true,
      });
      libDocCache.set(workspacePage.sourceDocId, libDoc);
    }

    const [copiedPage] = await outputDoc.copyPages(libDoc, [
      workspacePage.sourcePageIndex,
    ]);

    // Apply rotation delta on top of whatever the source page already has
    const currentRotation = copiedPage.getRotation().angle;
    const newRotation = (currentRotation + workspacePage.rotation) % 360;
    copiedPage.setRotation(degrees(newRotation));

    outputDoc.addPage(copiedPage);
  }

  return outputDoc.save();
}
