// Recipe: book + page, people ticker and the (scaled) ingredient list.

import { announce, keepFocus } from "../dom.js";
import {
  APPLIANCES, COURSES, amountText, dateLabel, dietLabel, escapeHtml as e, minutesLabel, timeLabel, unitLabel,
} from "../format.js";
import { icon } from "../icons.js";
import { factorFor, peopleFor, perPersonTotal, renderItem } from "../scale.js";
import { menuEntry } from "../storage.js";

const ticked = new Map(); // recipe id -> Set of ticked ingredient keys (this visit only)

export function defaultAmount(recipe) {
  return recipe.servings.unit === "personen" ? 2 : recipe.servings.count;
}

export const MAX_STEPS = 40;

/** Persons go per 1; large yields (24 repen) per half batch, odd ones (15 bolletjes) per batch. */
export function amountStep(recipe) {
  const { unit, count } = recipe.servings;
  if (unit === "personen" || count <= 12) return 1;
  return count % 2 ? count : count / 2;
}

export function ticker(recipe, amount, attrs = "") {
  const step = amountStep(recipe);
  return `<div class="ticker">
    <button type="button" data-action="less" ${attrs} aria-label="Minder"${amount - step < step ? " disabled" : ""}>${icon("minus")}</button>
    <output><b>${amountText(amount)}</b><span>${e(unitLabel(recipe.servings.unit, amount))}</span></output>
    <button type="button" data-action="more" ${attrs} aria-label="Meer"${amount >= step * MAX_STEPS ? " disabled" : ""}>${icon("plus")}</button>
  </div>`;
}

function servingsNote(recipe, amount) {
  const { servings } = recipe;
  if (servings.unit === "personen") {
    if (servings.assumed) return `Het boek vermeldt geen aantal; we gaan uit van ${servings.count} personen.`;
    if (servings.count !== amount) return `Het boek rekent op ${servings.count} ${unitLabel("personen", servings.count)}; hoeveelheden zijn omgerekend.`;
    return "Precies zoals in het boek.";
  }
  const base = `Het boek maakt ${servings.count} ${unitLabel(servings.unit, servings.count)}`;
  return servings.serves ? `${base}, goed voor ${servings.serves} personen.` : `${base}.`;
}

function timeFact(time) {
  const active = time.active && time.active !== time.total ? ` · ${minutesLabel(time.active)} werk` : "";
  const label = time.source === "estimated" ? `${timeLabel(time)} (geschat)` : timeLabel(time);
  return `<span class="fact">${icon("clock")}${label}${active}</span>`;
}

function ingredientList(recipe, factor, people) {
  const done = ticked.get(recipe.id) ?? new Set();
  return recipe.ingredients.map((group, g) => `
    ${group.group ? `<h3>${e(group.group)}</h3>` : ""}
    <ul>${group.items.map((item, i) => {
      const key = `${g}.${i}`;
      const text = renderItem(item, factor)
        .map((s) => (typeof s === "string" ? e(s) : `<span class="qty">${e(s.qty)}</span>`))
        .join("");
      const total = perPersonTotal(item, people);
      const totalText = total ? `<span class="pp-total">= ${e(total.qty)}${total.unit ? ` ${e(total.unit)}` : ""} voor ${people} ${people === 1 ? "persoon" : "personen"}</span>` : "";
      const classes = [done.has(key) ? "done" : "", item.p ? "pantry" : ""].filter(Boolean).join(" ");
      return `<li class="${classes}"><button type="button" data-action="tick" data-key="${key}" aria-pressed="${done.has(key)}">
        <span class="tick">${icon("check")}</span><span class="line">${text}${totalText}</span></button></li>`;
    }).join("")}</ul>`).join("");
}

export function renderRecipe(ctx, main, id) {
  const recipe = ctx.byId.get(id);
  if (!recipe) {
    main.innerHTML = `<div class="wrap"><div class="empty"><div class="big">📖</div><h3>Recept niet gevonden</h3>
      <p>Misschien is de link verouderd.</p><a class="button" href="#/">Naar alle recepten</a></div></div>`;
    return;
  }
  const amount = ctx.amounts.get(id) ?? menuEntry(ctx.user, id)?.amount ?? defaultAmount(recipe);
  const step = amountStep(recipe);
  const factor = factorFor(recipe, amount);
  const people = peopleFor(recipe, amount);
  const [ref, ...others] = recipe.refs;
  const book = ctx.books.get(ref.book);
  const favorite = ctx.user.favorites.includes(id);
  const planned = Boolean(menuEntry(ctx.user, id));
  const cookedDates = ctx.user.cooked[id] ?? [];
  const cookedToday = cookedDates.includes(ctx.today);
  const last = cookedDates[cookedDates.length - 1];

  const facts = [
    timeFact(recipe.time),
    ...recipe.appliances.map((a) => `<span class="fact">${e(APPLIANCES[a] ?? a)}</span>`),
    ...recipe.diet.map((d) => `<span class="fact">${dietLabel(d).emoji} ${e(dietLabel(d).label)}</span>`),
    recipe.time.ahead ? `<span class="fact warn">${icon("hourglass")}Op voorhand beginnen</span>` : "",
    ...recipe.tags.map((t) => `<span class="fact">${book.badges?.[t] ? `<span class="badge">${e(book.badges[t])}</span>` : ""}${e(t)}</span>`),
  ].join("");

  main.innerHTML = `
  <article class="recipe" style="--book:${e(book.color)}">
    <div class="recipe-bar">
      <button type="button" class="icon-button" data-action="back" aria-label="Terug">${icon("back")}</button>
      <div class="actions">
        <button type="button" class="icon-button" data-action="share" aria-label="Deel dit recept">${icon("share")}</button>
        <button type="button" class="icon-button" data-action="favorite" aria-pressed="${favorite}"
          aria-label="${favorite ? "Verwijder uit favorieten" : "Bewaar als favoriet"}" style="${favorite ? "color:var(--accent)" : ""}">${icon(favorite ? "heartFill" : "heart")}</button>
      </div>
    </div>
    <header class="recipe-head${recipe.image ? " with-photo" : ""}">
      ${recipe.image ? `<figure class="recipe-photo photo">
        <img src="${e(recipe.image.src)}" alt="${e(recipe.title)}" decoding="async" referrerpolicy="no-referrer" data-photo>
        <figcaption><a href="${e(recipe.image.page)}" target="_blank" rel="noopener noreferrer">Foto: ${e(recipe.image.credit)}</a></figcaption>
      </figure>` : ""}
      <div class="recipe-titles">
        <p class="eyebrow">${recipe.course.map((c) => e(COURSES[c])).join(" · ")}</p>
        <h1>${e(recipe.title)}</h1>
        ${recipe.subtitle ? `<p class="subtitle">${e(recipe.subtitle)}</p>` : ""}
      </div>
    </header>

    <div class="plate" role="note" aria-label="${e(`${book.title}, bladzijde ${ref.page}`)}">
      <div class="plate-text"><small>${e(book.author)}</small><strong>${e(book.title)}</strong>
        ${ref.section ? `<span class="section">${e(ref.section)}</span>` : ""}</div>
      <div class="plate-page"><small>blz.</small><b>${ref.page}</b></div>
    </div>
    ${others.map((o) => {
      const other = ctx.books.get(o.book);
      return `<p class="also-in" style="--book:${e(other.color)}">Staat ook in <span class="dot"></span><strong>${e(other.title)}</strong>, blz. ${o.page}</p>`;
    }).join("")}

    <div class="facts">${facts}</div>

    <section class="ticker-card" aria-labelledby="amount-title">
      <h2 id="amount-title">Voor hoeveel?</h2>
      ${ticker(recipe, amount)}
      <p>${e(servingsNote(recipe, amount))}</p>
    </section>

    <section class="ingredients">
      <h2>Ingrediënten</h2>
      ${ingredientList(recipe, factor, people)}
    </section>

    <p class="footnote">${icon("book")}<span>Bereiding: pak het boek erbij op blz. ${ref.page}. Hoeveelheden zijn omgerekend en afgerond.</span></p>
    ${last ? `<p class="cooked-note">✓ Laatst gemaakt: ${e(dateLabel(last, ctx.today))}${cookedDates.length > 1 ? ` · ${cookedDates.length}× gemaakt` : ""}</p>` : ""}

    <div class="recipe-actions">
      <button type="button" class="button${cookedToday ? " on" : ""}" data-action="cooked" aria-pressed="${cookedToday}">${icon("check")}${cookedToday ? "Gemaakt vandaag" : "Gemaakt"}</button>
      <button type="button" class="button${planned ? " on" : " primary"}" data-action="menu" aria-pressed="${planned}">${icon(planned ? "check" : "plus")}${planned ? "Op weekmenu" : "Weekmenu"}</button>
    </div>
  </article>`;

  const root = main.querySelector(".recipe");
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const rerender = () => keepFocus(() => renderRecipe(ctx, main, id));
    switch (target.dataset.action) {
      case "back": return ctx.back();
      case "less":
      case "more": {
        const next = amount + (target.dataset.action === "more" ? step : -step);
        ctx.amounts.set(id, next);
        ctx.setMenuAmount(id, next);
        rerender();
        return announce(`${amountText(next)} ${unitLabel(recipe.servings.unit, next)}`);
      }
      case "tick": {
        const set = ticked.get(id) ?? new Set();
        const key = target.dataset.key;
        if (set.has(key)) set.delete(key);
        else set.add(key);
        ticked.set(id, set);
        target.closest("li").classList.toggle("done", set.has(key));
        target.setAttribute("aria-pressed", String(set.has(key)));
        return;
      }
      case "favorite":
        ctx.toggleFavorite(id);
        return rerender();
      case "cooked":
        ctx.toggleCooked(id);
        return rerender();
      case "menu":
        ctx.toggleMenu(id, amount);
        return rerender();
      case "share":
        return ctx.share({ title: recipe.title, text: `${recipe.title} — ${book.title}, blz. ${ref.page}`, url: location.href });
      default:
    }
  });
}
