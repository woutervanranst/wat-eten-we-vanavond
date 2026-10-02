// Home: search, quick filters, filter panel and the result grid.

import { apply, suggestions } from "../filters.js";
import { card, courseChips, dietChips, filterPanel } from "../components.js";
import { announce, keepFocus } from "../dom.js";
import { escapeHtml as e, minutesLabel, plural } from "../format.js";
import { icon } from "../icons.js";
import { isEmpty, sheetFilterCount } from "../state.js";

const TIME_STEPS = [10, 15, 20, 30, 45, 60, 90, 120, null];
const PAGE = 48;

let view = null; // per-mount state: { limit, items, active, closeSuggestions, count }
let savedLimit = PAGE; // kept across navigation so "back" returns to the same list
let documentListener = null;

function timeIndex(max) {
  const i = TIME_STEPS.indexOf(max);
  return i === -1 ? TIME_STEPS.length - 1 : i;
}

function timeText(max) {
  return max ? `max. ${minutesLabel(max)}` : "Geen limiet";
}

export function renderHome(ctx, main, { keepPaging = false } = {}) {
  if (!keepPaging) savedLimit = PAGE;
  view = { limit: savedLimit, items: [], active: -1, count: null };
  const total = ctx.data.recipes.length;
  main.innerHTML = `
  <div class="wrap home">
    <div class="hero-block">
      <section class="hero">
        <h1>Wat eten we <em>vanavond</em>?</h1>
        <p>${total} recepten uit ${ctx.data.books.length} kookboeken. Zoek op wat je in huis hebt, of laat het lot beslissen.</p>
        <div class="search" role="search">
          <div class="search-field">
            ${icon("search")}
            <input id="q" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false"
              placeholder="Waar hebben jullie goesting in?"
              aria-label="Zoek op ingrediënt of gerecht" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="false">
            <button type="button" class="search-clear" data-action="clear-input" aria-label="Wis zoekveld" hidden>${icon("close")}</button>
          </div>
          <ul class="suggestions" id="suggestions" role="listbox" hidden></ul>
        </div>
        <div data-region="terms"></div>
      </section>
      <div class="filters-strip">
        <div class="chip-row" data-region="quick" aria-label="Snelle filters"></div>
        <div class="chip-row" data-region="courses" aria-label="Gang"></div>
        <div class="time-card">
          <label for="time">Klaar in</label>
          <output for="time" data-region="time-out">${timeText(ctx.state.max)}</output>
          <input id="time" type="range" min="0" max="${TIME_STEPS.length - 1}" step="1" value="${timeIndex(ctx.state.max)}"
            aria-valuetext="${timeText(ctx.state.max)}">
        </div>
      </div>
    </div>
    <aside class="aside panel" data-region="aside" aria-label="Meer filters"></aside>
    <section data-region="results" aria-label="Recepten"></section>
  </div>`;
  // Listeners live on the view's root element, so they disappear with it.
  bindHome(ctx, main.querySelector(".home"));
  refreshHome(ctx);
}

export function refreshHome(ctx) {
  const main = document.querySelector("main");
  if (!main.querySelector(".home")) return;
  keepFocus(() => renderRegions(ctx, main));
  if (view.count !== null && view.count !== ctx.results.length) {
    announce(plural(ctx.results.length, "recept", "recepten"));
  }
  view.count = ctx.results.length;
}

function renderRegions(ctx, main) {
  const { state } = ctx;
  const out = apply(ctx.data.recipes, state, ctx.user, ctx.today);
  ctx.results = out.results;
  const region = (name) => main.querySelector(`[data-region="${name}"]`);

  const withCount = state.terms.filter((t) => !t.without).length;
  region("terms").innerHTML = state.terms.length ? `
    <div class="terms">${state.terms.map((t, i) => `
      <span class="term${t.without ? " without" : ""}">
        <span class="term-text" data-action="flip-term" data-index="${i}" role="button" tabindex="0"
          title="Tik om te wisselen tussen mét en zónder">${t.without ? "zonder " : ""}${e(t.text)}</span>
        <button type="button" data-action="remove-term" data-index="${i}" aria-label="Verwijder ${e(t.text)}">${icon("close")}</button>
      </span>`).join("")}
    </div>
    ${withCount >= 2 ? `<div class="term-mode" role="group" aria-label="Hoe combineren?">
      <button type="button" data-action="pantry" data-value="0" aria-pressed="${!state.pantryMode}">Alles erin</button>
      <button type="button" data-action="pantry" data-value="1" aria-pressed="${state.pantryMode}">Wat heb ik in huis?</button>
    </div>` : ""}` : `
    <p class="examples">Probeer: ${["zalm", "kip", "courgette", "pasta", "aubergine", "ei"]
      .map((t) => `<button type="button" class="example" data-action="example" data-value="${t}">${t}</button>`).join("")}</p>`;

  const sheetCount = sheetFilterCount(state);
  region("quick").innerHTML = `
    ${dietChips(state, out.facets)}
    <button type="button" class="chip" data-action="flag-chip" data-value="favorites" aria-pressed="${state.favorites}">
      <span class="emoji" aria-hidden="true">♥</span><span class="chip-label">Favorieten</span></button>
    <button type="button" class="chip chip-more" data-action="open-filters">${icon("sliders")}<span class="chip-label">Meer filters</span>
      ${sheetCount ? `<span class="count">${sheetCount}</span>` : ""}</button>`;
  region("courses").innerHTML = courseChips(state, out.facets);
  region("time-out").textContent = timeText(state.max);
  const range = main.querySelector("#time");
  range.value = timeIndex(state.max);
  range.setAttribute("aria-valuetext", timeText(state.max));

  region("aside").innerHTML = filterPanel(ctx, state, out.facets);
  const sheet = document.getElementById("filters");
  if (sheet.open) renderSheet(ctx, out);

  const shown = out.results.slice(0, view.limit);
  const cardCtx = { ...ctx, ranking: out.ranking, termCount: out.termCount };
  region("results").innerHTML = `
    <div class="results-head">
      <div class="results-title">
        <h2><span>${out.results.length}</span> ${out.results.length === 1 ? "recept" : "recepten"}</h2>
        ${isEmpty(state) ? "" : '<button type="button" class="link-button" data-action="clear-all">Wis alles</button>'}
      </div>
      <div class="results-tools">
        <button type="button" class="button filters-button" data-action="open-filters">${icon("sliders")}Filters${sheetCount ? ` <span class="count">${sheetCount}</span>` : ""}</button>
        <label class="sort"><span class="sort-text">Sorteer</span>
          <select data-action="sort" aria-label="Sorteer">
            ${[["verrassend", "Verrassend"], ["snelst", "Snelst klaar"], ["lang", "Lang niet gemaakt"], ["boek", "Per boek"]]
              .map(([v, label]) => `<option value="${v}"${state.sort === v ? " selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>
    </div>
    ${out.results.length ? `<div class="grid">${shown.map((row) => card(cardCtx, row)).join("")}</div>` : `
      <div class="empty"><div class="big">🍽️</div><h3>Niets gevonden</h3>
        ${withCount >= 2 && !state.pantryMode ? `<p>Geen recept gebruikt al deze ingrediënten samen.</p>
          <button type="button" class="button primary" data-action="pantry" data-value="1">Toon recepten met een deel ervan</button>` : `
          <p>Probeer een filter minder, of zoek op een ander ingrediënt.</p>
          <button type="button" class="button" data-action="clear-all">Wis alle filters</button>`}</div>`}
    ${out.results.length > shown.length ? `<div class="more"><button type="button" class="button" data-action="more">
      Toon meer (${plural(out.results.length - shown.length, "recept", "recepten")})</button></div>` : ""}`;
}

export function renderSheet(ctx, out = apply(ctx.data.recipes, ctx.state, ctx.user, ctx.today)) {
  keepFocus(() => renderSheetContent(ctx, out));
}

function renderSheetContent(ctx, out) {
  const sheet = document.getElementById("filters");
  const body = sheet.querySelector(".sheet-body");
  const scroll = body?.scrollTop ?? 0;
  sheet.innerHTML = `
    <div class="sheet-head"><h2 id="filters-title">Meer filters</h2>
      <button type="button" class="icon-button" data-action="close-sheet" aria-label="Sluiten">${icon("close")}</button></div>
    <div class="sheet-body panel">${filterPanel(ctx, ctx.state, out.facets)}</div>
    <div class="sheet-foot">
      <button type="button" class="button" data-action="clear-sheet">Wis</button>
      <button type="button" class="button primary" data-action="close-sheet">Toon ${plural(out.results.length, "recept", "recepten")}</button>
    </div>`;
  sheet.querySelector(".sheet-body").scrollTop = scroll;
}

function toggleIn(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Handle filter actions shared by the page, the sidebar and the sheet. */
export function handleFilterAction(ctx, target) {
  const { action, value } = target.dataset;
  const set = (patch) => ctx.update(patch);
  const s = ctx.state;
  switch (action) {
    case "diet": return set({ diet: toggleIn(s.diet, value) });
    case "course": return set({ course: toggleIn(s.course, value) });
    case "book": {
      const books = toggleIn(s.books, value);
      return set({ books, sections: s.sections.filter((k) => books.includes(k.split("|")[0])) });
    }
    case "section": return set({ sections: toggleIn(s.sections, value) });
    case "tag": return set({ tags: toggleIn(s.tags, value) });
    case "appliance": {
      const appliances = { ...s.appliances };
      const next = { undefined: "met", met: "zonder", zonder: undefined }[appliances[value]];
      if (next) appliances[value] = next;
      else delete appliances[value];
      return set({ appliances });
    }
    case "flag": return set({ [value]: target.checked });
    case "flag-chip": return set({ [value]: !s[value] });
    case "pantry": return set({ pantryMode: value === "1" });
    case "clear-sheet":
      return set({ books: [], sections: [], tags: [], appliances: {}, favorites: false, never: false, noAhead: false });
    default: return false;
  }
}

function addTerm(ctx, text, without = false) {
  let clean = text.trim().toLowerCase();
  if (clean.startsWith("-")) {
    // "-koriander" means "zonder koriander", as in the URL.
    clean = clean.slice(1).trim();
    without = true;
  }
  if (!clean) return;
  const terms = ctx.state.terms.filter((t) => t.text !== clean);
  ctx.update({ terms: [...terms, { text: clean, without }] });
}

function bindHome(ctx, main) {
  const input = main.querySelector("#q");
  const list = main.querySelector("#suggestions");
  const clear = main.querySelector(".search-clear");

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    view.active = -1;
  };
  const show = () => {
    const text = input.value;
    clear.hidden = !text;
    view.items = suggestions(ctx.data.recipes, text);
    view.active = -1;
    if (!text.trim()) return close();
    const typed = e(text.trim());
    const highlight = (name) => e(name).replace(new RegExp(`(${e(text.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"), "<mark>$1</mark>");
    // Options are the clickable rows; the small "zonder" button is a mouse/touch shortcut
    // for Shift+Enter.
    list.innerHTML = view.items.map((s, i) => `
      <li role="option" id="sug-${i}" aria-selected="false" data-action="suggest" data-index="${i}">
        <span>${highlight(s.name)}</span><span class="hint">${plural(s.count, "recept", "recepten")}
        <button type="button" class="without" tabindex="-1" data-action="suggest-without" data-index="${i}"
          aria-label="Zonder ${e(s.name)}">zonder</button></span></li>`).join("")
      + `<li role="option" id="sug-free" aria-selected="false" data-action="suggest-free"><span>Zoek op „${typed}”</span><span class="hint">ook in titels</span></li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  const options = () => [...list.querySelectorAll('[role="option"]')];
  const highlightActive = () => {
    const all = options();
    all.forEach((o, i) => o.setAttribute("aria-selected", String(i === view.active)));
    if (view.active >= 0) input.setAttribute("aria-activedescendant", all[view.active].id);
    else input.removeAttribute("aria-activedescendant");
  };
  const choose = (name, without = false) => {
    addTerm(ctx, name, without);
    input.value = "";
    clear.hidden = true;
    close();
    input.focus();
  };

  input.addEventListener("input", show);
  input.addEventListener("focus", () => input.value && show());
  input.addEventListener("keydown", (event) => {
    const count = options().length;
    if (event.key === "ArrowDown" && !list.hidden) {
      view.active = (view.active + 1) % count;
      highlightActive();
      event.preventDefault();
    } else if (event.key === "ArrowUp" && !list.hidden) {
      view.active = (view.active - 1 + count) % count;
      highlightActive();
      event.preventDefault();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = view.items[view.active];
      choose(item ? item.name : input.value, event.shiftKey);
    } else if (event.key === "Escape") {
      close();
    } else if (event.key === "Backspace" && !input.value && ctx.state.terms.length) {
      ctx.update({ terms: ctx.state.terms.slice(0, -1) });
    }
  });
  view.closeSuggestions = close;
  if (!documentListener) {
    documentListener = (event) => {
      if (!event.target.closest(".search")) view?.closeSuggestions?.();
    };
    document.addEventListener("click", documentListener);
  }

  main.addEventListener("input", (event) => {
    if (event.target.id === "time") {
      const max = TIME_STEPS[Number(event.target.value)];
      main.querySelector('[data-region="time-out"]').textContent = timeText(max);
      ctx.update({ max });
    }
  });
  main.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.action === "sort") ctx.update({ sort: target.value });
    else if (target.dataset.action === "flag") handleFilterAction(ctx, target);
  });
  main.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.dataset.action === "flip-term") event.target.click();
  });
  main.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target || target.matches('input[type="checkbox"]')) return;
    const { action } = target.dataset;
    if (action === "suggest-without") {
      event.stopPropagation();
      return choose(view.items[Number(target.dataset.index)].name, true);
    }
    if (action === "suggest") return choose(view.items[Number(target.dataset.index)].name);
    if (action === "suggest-free") return choose(input.value);
    if (action === "clear-input") {
      input.value = "";
      clear.hidden = true;
      close();
      return input.focus();
    }
    if (action === "remove-term") {
      return ctx.update({ terms: ctx.state.terms.filter((_, i) => i !== Number(target.dataset.index)) });
    }
    if (action === "flip-term") {
      const terms = ctx.state.terms.map((t, i) => (i === Number(target.dataset.index) ? { ...t, without: !t.without } : t));
      return ctx.update({ terms });
    }
    if (action === "favorite") return ctx.toggleFavorite(target.dataset.id);
    if (action === "example") return addTerm(ctx, target.dataset.value);
    if (action === "open-filters") return ctx.openSheet();
    if (action === "clear-all") {
      input.value = "";
      return ctx.reset();
    }
    if (action === "more") {
      view.limit += PAGE;
      savedLimit = view.limit;
      return refreshHome(ctx);
    }
    handleFilterAction(ctx, target);
  });
}

export function resetPaging() {
  savedLimit = PAGE;
  if (view) view.limit = PAGE;
}
