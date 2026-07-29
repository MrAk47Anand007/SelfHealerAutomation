import type { UiCandidate, UiSelector } from "@uiheal/core";

export interface ScanPageOptions {
  selectors: UiSelector[];
  pageUrl: string;
}

export function buildScanExpression(selectors: UiSelector[]): string {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    function byXPath(path) {
      try {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch (error) {
        return null;
      }
    }
    function identity(el) {
      const rect = el.getBoundingClientRect();
      const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      return {
        candidateId: crypto.randomUUID(),
        url: location.href,
        element: {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || undefined,
          role: el.getAttribute('role') || undefined,
          id: el.id || undefined,
          name: el.getAttribute('name') || undefined,
          text: (el.innerText || el.value || '').trim().slice(0, 500),
          label: label ? label.textContent.trim() : undefined,
          classes: Array.from(el.classList),
          attributes: Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value]).slice(0, 30))
        },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      };
    }
    return selectors.map((selector) => {
      let el = null;
      if (selector.kind === 'css') el = document.querySelector(selector.value);
      if (selector.kind === 'xpath') el = byXPath(selector.value);
      if (selector.kind === 'id') el = document.getElementById(selector.value);
      if (selector.kind === 'name') el = document.querySelector('[name="' + CSS.escape(selector.value) + '"]');
      return el ? { ...identity(el), selector } : null;
    }).filter(Boolean);
  })()`;
}

export function parseScanResult(value: unknown): UiCandidate[] {
  return Array.isArray(value) ? (value as UiCandidate[]) : [];
}
