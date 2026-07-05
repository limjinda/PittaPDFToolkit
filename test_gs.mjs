import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

async function run() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    page.drawText('Hello World');
    const pdfBytes = await doc.save();
    writeFileSync('test_input.pdf', pdfBytes);
    
    try {
        const gs = 'src-tauri\\target\\debug\\resources\\gs\\windows\\gswin64c.exe';
        const result = execSync(`${gs} -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=test_output.pdf test_input.pdf`);
        console.log("Success", result.toString());
    } catch(err) {
        console.error("Error", err.message);
        console.error("Stderr", err.stderr?.toString());
        console.error("Stdout", err.stdout?.toString());
    }
}
run();
