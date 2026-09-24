import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/assets/tools/pdf.worker.min.mjs?v=20260714-1';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 75;
const MAX_CHARS = 350000;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

async function extractDocx(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('This file is not a valid DOCX package.');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return { text: normalizeText(result.value), pages: null, warnings: result.messages.map((message) => message.message).slice(0, 5) };
}

async function extractPdf(buffer) {
  const bytes = new Uint8Array(buffer);
  const signature = new TextDecoder().decode(bytes.slice(0, 5));
  if (signature !== '%PDF-') throw new Error('This file is not a valid PDF.');
  const loadingTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false });
  const document = await loadingTask.promise;
  if (document.numPages > MAX_PAGES) throw new Error(`PDFs are limited to ${MAX_PAGES} pages.`);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(`[Page ${pageNumber}]\n${text}`);
    page.cleanup();
    if (pages.join('\n\n').length > MAX_CHARS) break;
  }
  await document.destroy();
  const text = normalizeText(pages.join('\n\n'));
  if (text.length < 80) throw new Error('This PDF appears to be scanned or contains too little selectable text. OCR is not supported yet.');
  return { text, pages: document.numPages, warnings: [] };
}

self.addEventListener('message', async (event) => {
  const { fileName, fileType, buffer } = event.data ?? {};
  try {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_BYTES) throw new Error('Files are limited to 15 MB.');
    const lowerName = String(fileName).toLowerCase();
    let result;
    if (lowerName.endsWith('.docx') && fileType !== 'application/pdf') result = await extractDocx(buffer);
    else if (lowerName.endsWith('.pdf') || fileType === 'application/pdf') result = await extractPdf(buffer);
    else throw new Error('Choose a DOCX or text-based PDF.');
    if (result.text.length < 80) throw new Error('The document does not contain enough readable text.');
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Could not read this document.' });
  }
});
