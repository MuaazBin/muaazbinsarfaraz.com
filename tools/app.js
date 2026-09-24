import PptxGenJS from 'pptxgenjs';
import { cleanText, escapeHtml, safeFilename, validateDeck } from './deck-core.js';

const $ = (selector) => document.querySelector(selector);
const form = $('[data-form]');
const fileInput = $('[data-file-input]');
const dropZone = $('[data-drop-zone]');
const pastedText = $('[data-pasted-text]');
const state = { file: null, extracted: null, deck: null, selectedSlide: 0, config: {}, turnstileToken: '' };

const views = { input: $('[data-input-view]'), processing: $('[data-processing-view]'), result: $('[data-result-view]') };
const progressCopy = [
  ['Reading document', 'Your file is being converted to plain text locally.'],
  ['Checking content', 'Document text is being isolated and screened as untrusted source material.'],
  ['Structuring the story', 'Claude is identifying the narrative, hierarchy, and essential evidence.'],
  ['Designing slides', 'A safe, structured deck is being prepared for preview.'],
];

function showView(name) {
  Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setError(message = '') {
  const error = $('[data-form-error]');
  error.textContent = message;
  error.hidden = !message;
}

function humanBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function selectFile(file) {
  setError();
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) return setError('Files are limited to 15 MB.');
  if (!/\.(docx|pdf)$/i.test(file.name)) return setError('Choose a DOCX or text-based PDF.');
  state.file = file;
  state.extracted = null;
  $('[data-file-name]').textContent = file.name;
  $('[data-file-meta]').textContent = humanBytes(file.size);
  $('[data-file-type]').textContent = file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX';
  $('[data-file-chip]').hidden = false;
  dropZone.hidden = true;
  pastedText.value = '';
}

function removeFile() {
  state.file = null;
  state.extracted = null;
  fileInput.value = '';
  $('[data-file-chip]').hidden = true;
  dropZone.hidden = false;
}

function extractFile(file) {
  return new Promise(async (resolve, reject) => {
    const worker = new Worker('../assets/tools/extraction-worker.bundle.js?v=20260714-1', { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Document reading timed out. Try a smaller file.')); }, 30000);
    worker.addEventListener('message', (event) => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error));
    });
    worker.addEventListener('error', () => { clearTimeout(timer); worker.terminate(); reject(new Error('The document reader could not start.')); });
    const buffer = await file.arrayBuffer();
    worker.postMessage({ fileName: file.name, fileType: file.type, buffer }, [buffer]);
  });
}

function updateProgress(index) {
  $('[data-progress-title]').textContent = progressCopy[index][0];
  $('[data-progress-detail]').textContent = progressCopy[index][1];
  [...$('[data-progress-list]').children].forEach((item, itemIndex) => item.classList.toggle('active', itemIndex <= index));
}

async function generateDeck(payload) {
  const response = await fetch('/api/generate-deck', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Deck generation failed. Please try again.');
  return result;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError();
  const rawPasted = cleanText(pastedText.value, 350000);
  if (!state.file && rawPasted.length < 80) return setError('Add a DOCX, text PDF, or at least 80 characters of pasted text.');
  if (state.config.turnstileRequired && !state.turnstileToken) return setError('Please complete the verification before creating a deck.');
  showView('processing');
  try {
    updateProgress(0);
    const extraction = state.file ? await extractFile(state.file) : { text: rawPasted, pages: null, warnings: [] };
    state.extracted = extraction;
    updateProgress(1);
    await new Promise((resolve) => setTimeout(resolve, 220));
    updateProgress(2);
    const data = new FormData(form);
    const result = await generateDeck({
      document: { text: extraction.text, fileName: state.file?.name || 'Pasted text', pages: extraction.pages },
      preferences: {
        audience: cleanText(data.get('audience'), 100) || 'General professional audience',
        tone: data.get('tone'), length: data.get('length'), theme: data.get('theme'),
      },
      turnstileToken: state.turnstileToken,
    });
    updateProgress(3);
    state.deck = validateDeck(result.deck);
    state.selectedSlide = 0;
    renderDeck();
    showView('result');
    if (result.injectionScreen?.risk === 'high') showResultMessage('Embedded instruction-like text was detected and treated only as source content.');
  } catch (error) {
    showView('input');
    setError(error instanceof Error ? error.message : 'Could not create the deck.');
    window.turnstile?.reset();
    state.turnstileToken = '';
  }
});

function renderDeck() {
  $('[data-deck-title]').textContent = state.deck.title;
  $('[data-deck-meta]').textContent = `${state.deck.slides.length} editable slides · ${state.file?.name || 'Pasted text'}`;
  const list = $('[data-slide-list]');
  list.replaceChildren();
  state.deck.slides.forEach((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slide-thumb${index === state.selectedSlide ? ' active' : ''}`;
    button.setAttribute('aria-label', `Edit slide ${index + 1}: ${slide.title}`);
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
    const mini = document.createElement('div'); mini.className = 'thumb-canvas';
    const title = document.createElement('strong'); title.textContent = slide.title;
    mini.append(title, ...slide.body.slice(0, 3).map(() => { const line = document.createElement('i'); return line; }));
    button.append(number, mini);
    button.addEventListener('click', () => { state.selectedSlide = index; renderDeck(); });
    list.append(button);
  });
  renderSelectedSlide();
}

function renderSelectedSlide() {
  const slide = state.deck.slides[state.selectedSlide];
  const canvas = $('[data-slide-canvas]');
  canvas.className = `slide-canvas ${state.deck.theme} ${slide.type}`;
  canvas.replaceChildren();
  const kicker = document.createElement('span'); kicker.className = 'slide-kicker'; kicker.textContent = slide.kicker;
  const title = document.createElement('h2'); title.textContent = slide.title;
  const list = document.createElement('ul');
  [...slide.body, ...slide.secondary].forEach((point) => { const item = document.createElement('li'); item.textContent = point; list.append(item); });
  canvas.append(kicker, title, list);
  $('[data-edit-title]').value = slide.title;
  $('[data-edit-body]').value = [...slide.body, ...slide.secondary].join('\n');
  $('[data-edit-notes]').value = slide.speakerNotes;
}

function updateSelectedSlide() {
  const slide = state.deck.slides[state.selectedSlide];
  slide.title = cleanText($('[data-edit-title]').value, 180) || 'Untitled slide';
  slide.body = $('[data-edit-body]').value.split('\n').map((line) => cleanText(line, 360)).filter(Boolean).slice(0, 8);
  slide.secondary = [];
  slide.speakerNotes = cleanText($('[data-edit-notes]').value, 1800);
  renderDeck();
}

$('[data-edit-title]').addEventListener('change', updateSelectedSlide);
$('[data-edit-body]').addEventListener('change', updateSelectedSlide);
$('[data-edit-notes]').addEventListener('change', updateSelectedSlide);
$('[data-edit-title]').addEventListener('input', (event) => {
  const value = cleanText(event.target.value, 180) || 'Untitled slide';
  state.deck.slides[state.selectedSlide].title = value;
  const heading = $('[data-slide-canvas] h2');
  if (heading) heading.textContent = value;
});
$('[data-edit-body]').addEventListener('input', (event) => {
  const points = event.target.value.split('\n').map((line) => cleanText(line, 360)).filter(Boolean).slice(0, 8);
  const slide = state.deck.slides[state.selectedSlide];
  slide.body = points; slide.secondary = [];
  const list = $('[data-slide-canvas] ul');
  if (list) {
    list.replaceChildren(...points.map((point) => { const item = document.createElement('li'); item.textContent = point; return item; }));
  }
});
$('[data-edit-notes]').addEventListener('input', (event) => { state.deck.slides[state.selectedSlide].speakerNotes = cleanText(event.target.value, 1800); });

function showResultMessage(message, isError = false) {
  const element = $('[data-result-message]');
  element.textContent = message;
  element.style.color = isError ? '#a12d2d' : '';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function createHtmlDeck(deck) {
  const slides = deck.slides.map((slide, index) => `<section class="slide ${escapeHtml(slide.type)}"><div class="kicker">${escapeHtml(slide.kicker)}</div><h1>${escapeHtml(slide.title)}</h1><ul>${[...slide.body, ...slide.secondary].map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul><span class="number">${index + 1} / ${deck.slides.length}</span></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>${escapeHtml(deck.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#111;color:#16181a;font-family:Arial,sans-serif}.slide{display:none;position:relative;width:100vw;height:100vh;padding:8vw;background:#fff;flex-direction:column;justify-content:center}.slide.active{display:flex}.kicker{color:#3157d5;font-size:1.1vw;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.slide h1{max-width:14ch;margin:1.5vw 0 3vw;font:400 6vw/1 Georgia,serif;letter-spacing:-.05em}.slide ul{display:grid;gap:1.1vw;max-width:70vw;margin:0;padding-left:2vw;font-size:1.7vw;line-height:1.35}.number{position:absolute;right:3vw;bottom:2.5vw;color:#777;font-size:1vw}.section,.closing{background:#17191c;color:#fff}.quote h1{font-style:italic}body.editorial .slide{background:#f1eadf}@media(max-width:700px){.slide{padding:10vw}.kicker{font-size:2.4vw}.slide h1{font-size:9vw}.slide ul{font-size:3.2vw;max-width:82vw}.number{font-size:2vw}}</style></head><body class="${escapeHtml(deck.theme)}">${slides}<script>(()=>{let i=0;const s=[...document.querySelectorAll('.slide')];const show=n=>{i=(n+s.length)%s.length;s.forEach((x,j)=>x.classList.toggle('active',j===i))};addEventListener('keydown',e=>{if(['ArrowRight',' ','PageDown'].includes(e.key))show(i+1);if(['ArrowLeft','PageUp'].includes(e.key))show(i-1)});addEventListener('click',()=>show(i+1));show(0)})();</script></body></html>`;
}

async function createPptxBlob(deck) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Muaaz Bin Sarfaraz · Document to Deck';
  pptx.subject = 'AI-generated presentation';
  pptx.title = deck.title;
  pptx.company = 'Document to Deck';
  const dark = deck.theme === 'dark';
  const editorial = deck.theme === 'editorial';
  const bg = dark ? '17191C' : editorial ? 'F1EADF' : 'FFFFFF';
  const fg = dark ? 'FFFFFF' : '17191C';
  deck.slides.forEach((slide, index) => {
    const page = pptx.addSlide();
    page.background = { color: slide.type === 'section' || slide.type === 'closing' ? '17191C' : bg };
    const pageFg = slide.type === 'section' || slide.type === 'closing' ? 'FFFFFF' : fg;
    page.addText(slide.kicker.toUpperCase(), { x: 1, y: .8, w: 10.8, h: .3, fontFace: 'Arial', fontSize: 9, bold: true, charSpacing: 2, color: '3157D5', margin: 0 });
    page.addText(slide.title, { x: 1, y: 1.3, w: 11, h: slide.body.length ? 1.55 : 3.6, fontFace: 'Georgia', fontSize: slide.title.length > 70 ? 27 : 34, color: pageFg, breakLine: false, margin: 0, valign: slide.body.length ? 'top' : 'mid', bold: false });
    const points = [...slide.body, ...slide.secondary];
    if (points.length) page.addText(points.map((text) => ({ text, options: { bullet: { indent: 16 }, hanging: 4, breakLine: true } })), { x: 1.05, y: 3.25, w: 10.4, h: 3.1, fontFace: 'Arial', fontSize: points.length > 6 ? 15 : 18, color: pageFg, breakLine: true, margin: 0, paraSpaceAfterPt: 10, valign: 'top' });
    page.addText(`${index + 1} / ${deck.slides.length}`, { x: 11.7, y: 7.05, w: .8, h: .2, fontFace: 'Arial', fontSize: 7, color: dark ? 'B8BABD' : '777777', align: 'right', margin: 0 });
    if (slide.speakerNotes) page.addNotes(slide.speakerNotes.split('\n'));
  });
  return pptx.write({ outputType: 'blob' });
}

$('[data-export-html]').addEventListener('click', () => {
  downloadBlob(new Blob([createHtmlDeck(state.deck)], { type: 'text/html;charset=utf-8' }), safeFilename(state.deck.title, 'html'));
  showResultMessage('HTML deck downloaded. Use arrow keys or click to present.');
});

$('[data-export-pptx]').addEventListener('click', async () => {
  try { showResultMessage('Preparing editable PowerPoint…'); const blob = await createPptxBlob(state.deck); downloadBlob(blob, safeFilename(state.deck.title, 'pptx')); showResultMessage('PowerPoint downloaded.'); }
  catch { showResultMessage('PowerPoint export failed in this browser.', true); }
});

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.onload = resolve; script.onerror = reject; document.head.append(script);
  });
}

async function uploadToGoogleSlides(token, pptxBlob) {
  const boundary = `deck_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: safeFilename(state.deck.title, 'pptx').replace(/\.pptx$/, ''), mimeType: 'application/vnd.google-apps.presentation' });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`, pptxBlob, `\r\n--${boundary}--`]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const result = await response.json();
  if (!response.ok || !result.id) throw new Error(result.error?.message || 'Google Slides upload failed.');
  return `https://docs.google.com/presentation/d/${encodeURIComponent(result.id)}/edit`;
}

$('[data-export-google]').addEventListener('click', async () => {
  try {
    if (!state.config.googleOAuthClientId) throw new Error('Google Slides export is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID in Cloudflare Pages.');
    showResultMessage('Connecting securely to Google…');
    await loadGoogleIdentity();
    const popup = window.open('about:blank', '_blank');
    const token = await new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({ client_id: state.config.googleOAuthClientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: (response) => response.error ? reject(new Error(response.error)) : resolve(response.access_token), error_callback: () => reject(new Error('Google authorization was cancelled.')) });
      client.requestAccessToken({ prompt: '' });
    });
    showResultMessage('Converting to native Google Slides…');
    const url = await uploadToGoogleSlides(token, await createPptxBlob(state.deck));
    if (popup) popup.location = url; else window.open(url, '_blank', 'noopener');
    showResultMessage('Google Slides presentation created.');
  } catch (error) { showResultMessage(error instanceof Error ? error.message : 'Google Slides export failed.', true); }
});

$('[data-start-over]').addEventListener('click', () => { state.deck = null; removeFile(); pastedText.value = ''; showResultMessage(''); showView('input'); });
$('[data-choose-file]').addEventListener('click', () => fileInput.click());
$('[data-remove-file]').addEventListener('click', removeFile);
fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
pastedText.addEventListener('input', () => { if (pastedText.value.trim()) removeFile(); });
['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));

function renderTurnstile(siteKey) {
  if (!siteKey) return;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
  script.onload = () => window.turnstile.render($('[data-turnstile]'), { sitekey: siteKey, theme: 'light', size: 'flexible', callback: (token) => { state.turnstileToken = token; }, 'expired-callback': () => { state.turnstileToken = ''; } });
  document.head.append(script);
}

fetch('/api/config').then((response) => response.ok ? response.json() : {}).then((config) => { state.config = config; renderTurnstile(config.turnstileSiteKey); }).catch(() => { state.config = {}; });
