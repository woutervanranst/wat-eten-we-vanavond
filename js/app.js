// Entry point: loads the recipes, routes between views and owns the app state.

import { announce } from "./dom.js";
import { prepare } from "./filters.js";
import { todayIso } from "./format.js";
import { hydrateIcons } from "./icons.js";
import { emptyState, fromQuery, toQuery } from "./state.js";
import {
  loadUser, markCooked, menuEntry, saveUser, setMenuAmount, toggleFavorite, toggleMenu, unmarkCooked,
} from "./storage.js";
import { handleFilterAction, refreshHome, renderHome, renderSheet, resetPaging } from "./views/home.js";
import { renderMenu } from "./views/menu.js";
import { renderRecipe } from "./views/recipe.js";
import { openSurprise, scopeLabel } from "./views/surprise.js";

const main = document.getElementById("main");
let homeScroll = 0;
let homeQuery = null; // the home query the user left, to restore scroll + paging on return
let inAppHistory = false; // true when "back" can safely use history.back()

const ctx = {
  data: null,
  byId: new Map(),
  books: new Map(),
  sections: new Map(),
  tags: new Map(),
  appliances: [],
  user: loadUser(),
  state: emptyState(),
  today: todayIso(),
  amounts: new Map(), // recipe id -> chosen amount during this visit
  results: [],

  save() {
    saveUser(ctx.user);
    updateMenuCount();
  },
  update(patch) {
    ctx.state = { ...ctx.state, ...patch };
    if (!main.querySelector(".home")) return;
    const query = toQuery(ctx.state);
    history.replaceState(null, "", query ? `#/?${query}` : "#/");
    resetPaging();
    refreshHome(ctx);
  },
  reset() {
    ctx.update(emptyState());
  },
  navigate(hash) {
    location.hash = hash;
  },
  back() {
    if (inAppHistory) history.back();
    else ctx.navigate("#/");
  },
  openSheet() {
    const sheet = document.getElementById("filters");
    renderSheet(ctx);
    sheet.showModal();
  },
  toggleFavorite(id) {
    toggleFavorite(ctx.user, id);
    ctx.save();
    if (main.querySelector(".home")) refreshHome(ctx);
    toast(ctx.user.favorites.includes(id) ? "Bewaard bij je favorieten ♥" : "Niet meer bij je favorieten");
  },
  toggleCooked(id) {
    if ((ctx.user.cooked[id] ?? []).includes(ctx.today)) unmarkCooked(ctx.user, id, ctx.today);
    else {
      markCooked(ctx.user, id, ctx.today);
      toast("Smakelijk! Genoteerd als gemaakt.");
    }
    ctx.save();
  },
  toggleMenu(id, amount) {
    const planned = Boolean(menuEntry(ctx.user, id));
    toggleMenu(ctx.user, id, amount);
    ctx.save();
    toast(planned ? "Van het weekmenu gehaald" : "Op het weekmenu gezet 🧺");
  },
  setMenuAmount(id, amount) {
    setMenuAmount(ctx.user, id, amount);
    ctx.save();
  },
  async share({ title, text, url }) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    await ctx.copy([text, url].filter(Boolean).join("\n"), "Gekopieerd — plak het waar je wil");
  },
  async copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Kopiëren lukte niet");
    }
  },
};

let toastTimer;
function toast(message) {
  const el = document.querySelector(".toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function updateMenuCount() {
  const count = ctx.user.menu.filter((m) => ctx.byId.has(m.id)).length;
  for (const el of document.querySelectorAll("[data-menu-count]")) {
    el.textContent = count;
    el.hidden = !count;
  }
}

function setCurrentNav(name) {
  for (const el of document.querySelectorAll("[data-nav]")) {
    if (el.dataset.nav === name) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  }
}

let previousRoute = "";
function route() {
  const hash = location.hash || "#/";
  if (!hash.startsWith("#/")) return; // in-page anchors such as the skip link
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  if (previousRoute === "home") {
    homeScroll = window.scrollY;
    homeQuery = toQuery(ctx.state);
  }
  inAppHistory = Boolean(previousRoute);
  if (hash.startsWith("#/r/")) {
    previousRoute = "recipe";
    setCurrentNav("");
    renderRecipe(ctx, main, decodeURIComponent(hash.slice(4)));
    window.scrollTo(0, 0);
  } else if (hash.startsWith("#/menu")) {
    previousRoute = "menu";
    setCurrentNav("menu");
    renderMenu(ctx, main);
    window.scrollTo(0, 0);
  } else {
    const returning = previousRoute === "recipe";
    previousRoute = "home";
    setCurrentNav("home");
    ctx.state = fromQuery(hash.split("?")[1] ?? "");
    const restore = returning && toQuery(ctx.state) === homeQuery;
    renderHome(ctx, main, { keepPaging: restore });
    window.scrollTo(0, restore ? homeScroll : 0);
  }
  const title = main.querySelector("h1")?.textContent;
  document.title = hash.startsWith("#/r/") && title ? `${title} · Wat eten we vanavond?` : "Wat eten we vanavond?";
}

function surprise() {
  const onHome = Boolean(main.querySelector(".home"));
  const pool = onHome ? ctx.results.map((r) => r.recipe) : ctx.data.recipes;
  openSurprise(ctx, pool, scopeLabel(pool.length, ctx.data.recipes.length));
}

function bindChrome() {
  // Linked photos live on another site; if one fails, drop it and keep the text layout.
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-photo")) return;
    img.closest(".card")?.classList.remove("has-photo");
    img.closest(".photo")?.remove();
  }, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="surprise"]')) surprise();
  });
  const sheet = document.getElementById("filters");
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) return sheet.close();
    const target = event.target.closest("[data-action]");
    if (!target || target.matches('input[type="checkbox"]')) return;
    if (target.dataset.action === "close-sheet") return sheet.close();
    handleFilterAction(ctx, target);
  });
  sheet.addEventListener("change", (event) => {
    if (event.target.dataset.action === "flag") handleFilterAction(ctx, event.target);
  });
  window.addEventListener("hashchange", route);
}

const rank = (order, value) => (order.includes(value) ? order.indexOf(value) : order.length);

function index(data) {
  const bookIds = new Set(data.books.map((b) => b.id));
  data.recipes = data.recipes.filter((r) => r.refs.length && r.refs.every((ref) => bookIds.has(ref.book)));
  for (const book of data.books) {
    book.badgeOrder = (book.badges ?? []).map(([tag]) => tag);
    book.badges = Object.fromEntries(book.badges ?? []);
  }
  ctx.data = prepare(data);
  for (const recipe of data.recipes) ctx.byId.set(recipe.id, recipe);
  for (const book of data.books) ctx.books.set(book.id, book);
  const sectionPages = new Map();
  const tagCounts = new Map();
  const applianceCounts = new Map();
  for (const recipe of data.recipes) {
    for (const ref of recipe.refs) {
      const key = `${ref.book}|${ref.section}`;
      if (ref.section && !sectionPages.has(key)) sectionPages.set(key, ref.page);
      if (ref.section) sectionPages.set(key, Math.min(sectionPages.get(key), ref.page));
    }
    for (const tag of recipe.tags) {
      const key = `${recipe.refs[0].book}|${tag}`;
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
    for (const a of recipe.appliances) applianceCounts.set(a, (applianceCounts.get(a) ?? 0) + 1);
  }
  for (const book of data.books) {
    ctx.sections.set(book.id, [...sectionPages]
      .filter(([key]) => key.startsWith(`${book.id}|`))
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => key.slice(book.id.length + 1)));
    const badgeOrder = book.badgeOrder;
    ctx.tags.set(book.id, [...tagCounts.keys()]
      .filter((key) => key.startsWith(`${book.id}|`))
      .map((key) => key.slice(book.id.length + 1))
      .sort((a, b) => (rank(badgeOrder, a) - rank(badgeOrder, b)) || a.localeCompare(b)));
  }
  ctx.appliances = [...applianceCounts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

async function boot() {
  hydrateIcons();
  bindChrome();
  try {
    const response = await fetch("data/recipes.json");
    if (!response.ok) throw new Error(response.statusText);
    index(await response.json());
  } catch (error) {
    main.innerHTML = `<div class="wrap"><div class="empty"><div class="big">🥄</div><h3>De recepten konden niet geladen worden</h3>
      <p>Probeer de pagina opnieuw te laden.</p></div></div>`;
    console.error(error);
    return;
  }
  updateMenuCount();
  route();
}

boot();
