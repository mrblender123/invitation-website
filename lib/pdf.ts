import { PDFDocument } from 'pdf-lib';

export async function pngToPdf(pngBuffer: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(pngBuffer);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return Buffer.from(await pdf.save());
}
