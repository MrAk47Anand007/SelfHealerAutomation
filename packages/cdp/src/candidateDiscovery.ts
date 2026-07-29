import type { UiTarget } from "@uiheal/core";

export function buildCandidateDiscoveryExpression(target: UiTarget): string {
  return `(() => {
    const target = ${JSON.stringify(target)};
    const candidates = new Map();
    function cssFor(el) {
      if (el.id) return "#" + CSS.escape(el.id);
      const name = el.getAttribute("name");
      if (name) return el.tagName.toLowerCase() + "[name='" + CSS.escape(name) + "']";
      const type = el.getAttribute("type");
      if (type) return el.tagName.toLowerCase() + "[type='" + CSS.escape(type) + "']";
      return el.tagName.toLowerCase();
    }
    function add(el, selectorValue, reason) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const key = selectorValue + "|" + rect.x + "|" + rect.y;
      if (candidates.has(key)) return;
      const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      candidates.set(key, {
        candidateId: key,
        selector: { kind: "css", value: selectorValue, enabled: true, source: "cdp:" + reason },
        url: location.href,
        element: {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || undefined,
          role: el.getAttribute("role") || undefined,
          id: el.id || undefined,
          name: el.getAttribute("name") || undefined,
          text: (el.innerText || el.value || "").trim().slice(0, 500),
          label: label ? label.textContent.trim() : undefined,
          classes: Array.from(el.classList)
        },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        metadata: { reason }
      });
    }
    function byXPath(path) {
      try {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch (error) {
        return null;
      }
    }
    for (const selector of target.selectors || []) {
      if (!selector.enabled) continue;
      if (selector.kind === "css") { try { add(document.querySelector(selector.value), selector.value, "stored-css"); } catch(e) {} }
      if (selector.kind === "xpath") add(byXPath(selector.value), cssFor(byXPath(selector.value)), "stored-xpath");
      if (selector.kind === "id") add(document.getElementById(selector.value), "#" + CSS.escape(selector.value), "stored-id");
      if (selector.kind === "name") document.querySelectorAll('[name="' + CSS.escape(selector.value) + '"]').forEach((el) => add(el, cssFor(el), "stored-name"));
    }
    if (target.element?.id) add(document.getElementById(target.element.id), "#" + CSS.escape(target.element.id), "target-id");
    if (target.element?.name) document.querySelectorAll('[name="' + CSS.escape(target.element.name) + '"]').forEach((el) => add(el, cssFor(el), "target-name"));
    const tag = target.element?.tag || "*";
    document.querySelectorAll(tag).forEach((el, index) => {
      const typeOk = !target.element?.type || el.getAttribute("type") === target.element.type;
      if (typeOk && index < 200) add(el, cssFor(el), "tag-type-pool");
    });
    if (target.element?.label) {
      document.querySelectorAll("label").forEach((label) => {
        if ((label.textContent || "").trim().toLowerCase().includes(String(target.element.label).toLowerCase())) {
          const forId = label.getAttribute("for");
          if (forId) add(document.getElementById(forId), "#" + CSS.escape(forId), "label-for");
        }
      });
    }
    return Array.from(candidates.values());
  })()`;
}
