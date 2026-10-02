// Weekmenu with per-recipe amounts and a merged shopping list.

import { keepFocus } from "../dom.js";
import { escapeHtml as e, plural } from "../format.js";
import { icon } from "../icons.js";
import { asText, shoppingList } from "../shopping.js";
import { amountStep, MAX_STEPS, ticker } from "./recipe.js";

export function renderMenu(ctx, main) {
  const entries = ctx.user.menu.filter((m) => ctx.byId.has(m.id));
  if (!entries.length) {
    main.innerHTML = `
      <div class="menu-page">
        <h1>Week<em>menu</em></h1>
        <div class="empty"><div class="big">🧺</div><h3>Nog niets gepland</h3>
          <p>Open een recept en tik op <strong>Op weekmenu</strong>. Hier verschijnt dan je boodschappenlijst.</p>
          <a class="button primary" href="#/">Recepten ontdekken</a></div>
      </div>`;
    return;
  }
  const list = shoppingList(entries, ctx.byId);
  // Forget ticks for items that are no longer on the list (recipes removed one by one).
  const keys = new Set(list.map((l) => l.key));
  const checked = Object.fromEntries(Object.entries(ctx.user.checked ?? {}).filter(([key]) => keys.has(key)));
  if (Object.keys(checked).length !== Object.keys(ctx.user.checked ?? {}).length) {
    ctx.user.checked = checked;
    ctx.save();
  }
  const line = (l) => `
    <li><label><input type="checkbox" data-key="${e(l.key)}"${checked[l.key] ? " checked" : ""}>
      <span>${e(l.label)}${l.details.length > 1 ? `<small>${l.details.map((d) => `${e(d.text)} — ${e(d.title)}`).join("<br>")}</small>` : `<small>${e(l.details[0].title)}</small>`}</span>
    </label></li>`;
  const toBuy = list.filter((l) => !l.pantry);
  const pantry = list.filter((l) => l.pantry);

  main.innerHTML = `
  <div class="menu-page">
    <h1>Week<em>menu</em></h1>
    <p>${plural(entries.length, "recept", "recepten")} gepland. Pas per recept het aantal personen aan; de lijst rekent mee.</p>
    <ul class="planned">${entries.map((entry) => {
      const recipe = ctx.byId.get(entry.id);
      const ref = recipe.refs[0];
      const book = ctx.books.get(ref.book);
      return `<li style="--book:${e(book.color)}">
        <a href="#/r/${e(recipe.id)}"><strong>${e(recipe.title)}</strong><small>${e(book.title)} · blz. ${ref.page}</small></a>
        <div class="row-tools">
          ${ticker(recipe, Number(entry.amount) || amountStep(recipe), `data-id="${e(entry.id)}"`)}
          <button type="button" class="icon-button" data-action="remove" data-id="${e(entry.id)}" aria-label="Haal ${e(recipe.title)} van het weekmenu">${icon("trash")}</button>
        </div>
      </li>`;
    }).join("")}</ul>

    <section class="shopping" aria-labelledby="shopping-title">
      <div class="shopping-head">
        <h2 id="shopping-title">Boodschappenlijst</h2>
        <div class="tools">
          <button type="button" class="button" data-action="copy">${icon("copy")}Kopieer</button>
          <button type="button" class="button primary" data-action="share">${icon("share")}Delen</button>
        </div>
      </div>
      <ul>${toBuy.map(line).join("")}</ul>
      ${pantry.length ? `<details><summary>Heb je dit in huis? (${pantry.length})</summary><ul>${pantry.map(line).join("")}</ul></details>` : ""}
      <div class="more"><button type="button" class="link-button" data-action="clear">Weekmenu leegmaken</button></div>
    </section>
  </div>`;

  const root = main.querySelector(".menu-page");
  root.addEventListener("change", (event) => {
    const key = event.target.dataset.key;
    if (!key) return;
    ctx.user.checked = { ...ctx.user.checked, [key]: event.target.checked };
    if (!event.target.checked) delete ctx.user.checked[key];
    ctx.save();
  });
  root.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;
    const rerender = () => keepFocus(() => renderMenu(ctx, main));
    if (action === "less" || action === "more") {
      const entry = ctx.user.menu.find((m) => m.id === id);
      const step = amountStep(ctx.byId.get(id));
      const next = entry.amount + (action === "more" ? step : -step);
      if (next < step || next > step * MAX_STEPS) return;
      ctx.setMenuAmount(id, next);
      ctx.amounts.set(id, entry.amount);
      return rerender();
    }
    if (action === "remove") {
      ctx.toggleMenu(id);
      return rerender();
    }
    if (action === "copy") return ctx.copy(asText(list), "Boodschappenlijst gekopieerd");
    if (action === "share") return ctx.share({ title: "Boodschappenlijst", text: asText(list) });
    if (action === "clear" && window.confirm("Het weekmenu en de afgevinkte boodschappen wissen?")) {
      ctx.user.menu = [];
      ctx.user.checked = {};
      ctx.save();
      return rerender();
    }
  });
}
