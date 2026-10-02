// DOM helpers shared by the views.

/** Key that identifies a control across re-renders (same action + value/key/index/id). */
function controlKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const { action, value, key, index, id } = el.dataset ?? {};
  if (!action) return null;
  let selector = `[data-action="${CSS.escape(action)}"]`;
  if (value !== undefined) selector += `[data-value="${CSS.escape(value)}"]`;
  if (key !== undefined) selector += `[data-key="${CSS.escape(key)}"]`;
  if (index !== undefined) selector += `[data-index="${CSS.escape(index)}"]`;
  if (id !== undefined) selector += `[data-id="${CSS.escape(id)}"]`;
  return selector;
}

/** Run a re-render and put keyboard focus back on the equivalent control. */
export function keepFocus(render) {
  const active = document.activeElement;
  const selector = controlKey(active);
  const scope = active?.closest("dialog") ?? document;
  render();
  if (!selector || document.activeElement === active) return;
  const next = scope.querySelector(selector) ?? document.querySelector(selector);
  next?.focus({ preventScroll: true });
}

/** Announce a short message to screen readers via the persistent status region. */
export function announce(message) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = "";
  requestAnimationFrame(() => (status.textContent = message));
}
