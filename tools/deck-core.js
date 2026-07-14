export const SLIDE_TYPES = new Set(['title', 'section', 'content', 'two-column', 'quote', 'process', 'closing']);

export function cleanText(value, maxLength = 5000) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function validateDeck(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.slides)) {
    throw new Error('The generated deck is not valid.');
  }

  const slides = input.slides.slice(0, 20).map((slide, index) => {
    if (!slide || typeof slide !== 'object') throw new Error(`Slide ${index + 1} is invalid.`);
    const type = SLIDE_TYPES.has(slide.type) ? slide.type : 'content';
    const title = cleanText(slide.title, 180);
    if (!title) throw new Error(`Slide ${index + 1} needs a title.`);
    const body = Array.isArray(slide.body) ? slide.body.slice(0, 8).map((item) => cleanText(item, 360)).filter(Boolean) : [];
    const secondary = Array.isArray(slide.secondary) ? slide.secondary.slice(0, 8).map((item) => cleanText(item, 360)).filter(Boolean) : [];
    return {
      id: cleanText(slide.id, 50) || `slide-${index + 1}`,
      type,
      kicker: cleanText(slide.kicker, 80),
      title,
      body,
      secondary,
      speakerNotes: cleanText(slide.speakerNotes, 1800),
      sourcePages: Array.isArray(slide.sourcePages)
        ? slide.sourcePages.slice(0, 20).map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : [],
    };
  });

  if (slides.length < 3) throw new Error('The generated deck needs at least three slides.');
  return {
    title: cleanText(input.title, 180) || slides[0].title,
    subtitle: cleanText(input.subtitle, 240),
    theme: ['light', 'dark', 'editorial'].includes(input.theme) ? input.theme : 'light',
    slides,
  };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function safeFilename(value, extension) {
  const base = cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'presentation';
  return `${base}.${extension}`;
}
