export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Resolves a link against the page it came from. Ignores javascript:, data: and empty links. */
export function absoluteUrl(href: string | null | undefined, base: string): string | undefined {
  const value = href?.trim();
  if (!value || value === '#' || /^(javascript|data):/i.test(value)) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

/** Text content with whitespace collapsed. */
export function cleanText(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Text of a block where <br> and paragraphs become line breaks, e.g. a novel summary. */
export function blockText(el: Element | null | undefined): string {
  if (!el) return '';
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  copy.querySelectorAll('p, div').forEach((block) => block.append('\n\n'));
  return (copy.textContent ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
