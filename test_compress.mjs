import { compress } from '@quicktoolsone/pdf-compress';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'fs';

async function run() {
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    page.drawText('Hello World', { x: 50, y: 400 });
    const pdfBytes = await doc.save();
    
    console.log("Compressing...");
    const result = await compress(pdfBytes.buffer, { preset: 'balanced', mergeStrategy: 'main' });
    console.log("Success! Saved:", result.stats.percentageSaved);
  } catch (err) {
    console.error("Compression Failed:", err.message);
    if (err.underlyingError) {
      console.error("Underlying Error:", err.underlyingError);
    }
  }
}
run();
