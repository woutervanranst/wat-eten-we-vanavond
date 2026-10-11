// Shared HTML building blocks (cards, chips, filter panel).

import { APPLIANCES, COURSE_ORDER, COURSES, DIETS, dietLabel, escapeHtml as e, timeLabel } from "./format.js";
import { icon } from "./icons.js";

export function bookOf(ctx, id) {
  return ctx.books.get(id);
}

export function recipeHref(recipe) {
  return `#/r/${e(recipe.id)}`;
}

export function card(ctx, row) {
  const { recipe } = row;
  const ref = recipe.refs[0];
  const book = bookOf(ctx, ref.book);
  const favorite = ctx.user.favorites.includes(recipe.id);
  const cooked = Boolean(ctx.user.cooked[recipe.id]);
  const badges = recipe.tags
    .map((tag) => (book.badges?.[tag] ? `<span class="badge" title="${e(tag)}">${e(book.badges[tag])}</span>` : `<span class="badge text">${e(tag)}</span>`))
    .join("");
  const diets = recipe.diet.map((d) => `<span title="${e(dietLabel(d).label)}">${dietLabel(d).emoji}</span>`).join("");
  const also = recipe.refs.length > 1 ? `<span class="also">+${recipe.refs.length - 1}</span>` : "";
  const match = ctx.ranking && row.matched
    ? `<span class="match-note">${row.matched} van je ${ctx.termCount} ingrediënten${row.missing ? ` · nog ${row.missing} andere` : ""}</span>`
    : "";
  const photo = recipe.image
    ? `<span class="card-photo photo"><img src="${e(recipe.image.src)}" alt="" loading="lazy" decoding="async"
        referrerpolicy="no-referrer" data-photo></span>`
    : "";
  return `
  <article class="card${cooked ? " cooked" : ""}${photo ? " has-photo" : ""}" style="--book:${e(book.color)}">
    <a class="card-link" href="${recipeHref(recipe)}">
      ${photo}
      <div class="card-text">
      <div class="card-top">
        <span>${e(COURSES[recipe.course[0]])}</span>
        <span class="time">${icon("clock")}${timeLabel(recipe.time)}</span>
        ${recipe.time.ahead ? '<span class="ahead">· op voorhand</span>' : ""}
      </div>
      <h3 class="card-title">${e(recipe.title)}</h3>
      ${recipe.subtitle ? `<p class="card-sub">${e(recipe.subtitle)}</p>` : ""}
      ${match}
      <div class="card-foot">
        <span class="card-book"><span class="dot"></span>${e(book.short)} · blz. ${ref.page}${also}</span>
        <span class="card-icons">${diets}${badges}</span>
      </div>
      </div>
    </a>
    <button class="card-fav" type="button" data-action="favorite" data-id="${e(recipe.id)}" aria-pressed="${favorite}"
      aria-label="${favorite ? "Verwijder uit favorieten" : "Bewaar als favoriet"}">${icon(favorite ? "heartFill" : "heart")}</button>
  </article>`;
}

function chip({ action, value, label, count, pressed, mode, emoji, disabled }) {
  const n = count === undefined ? "" : `<span class="n">${count}</span>`;
  const attrs = mode ? `data-mode="${mode}" aria-pressed="${mode === "met"}"` : `aria-pressed="${Boolean(pressed)}"`;
  return `<button type="button" class="chip" data-action="${action}" data-value="${e(value)}" ${attrs}${disabled ? " disabled" : ""}>
    ${emoji ? `<span class="emoji" aria-hidden="true">${emoji}</span>` : ""}<span class="chip-label">${e(label)}</span>${n}</button>`;
}

export function dietChips(state, facets) {
  return Object.entries(DIETS)
    .map(([key, { label, emoji }]) => chip({
      action: "diet", value: key, label, emoji, count: facets.diet[key] ?? 0,
      pressed: state.diet.includes(key), disabled: !facets.diet[key] && !state.diet.includes(key),
    }))
    .join("");
}

export function courseChips(state, facets) {
  return COURSE_ORDER
    .filter((c) => facets.course[c] || state.course.includes(c))
    .map((c) => chip({ action: "course", value: c, label: COURSES[c], count: facets.course[c] ?? 0, pressed: state.course.includes(c) }))
    .join("");
}

/** Filter panel used in the desktop sidebar and the mobile sheet. */
export function filterPanel(ctx, state, facets) {
  const books = ctx.data.books
    .map((b) => `
      <button type="button" class="book-tile" style="--book:${e(b.color)}" data-action="book" data-value="${e(b.id)}" aria-pressed="${state.books.includes(b.id)}">
        <span class="spine"></span><span><strong>${e(b.title)}</strong><small>${e(b.author)}</small></span>
        <span class="n">${facets.books[b.id] ?? 0}</span>
      </button>`)
    .join("");

  const chosen = state.books.length ? ctx.data.books.filter((b) => state.books.includes(b.id)) : [];
  const sections = chosen.length
    ? chosen.map((b) => {
      const names = ctx.sections.get(b.id) ?? [];
      return `<div class="subgroup" style="--book:${e(b.color)}"><h4>${e(b.short)}</h4><div class="chip-wrap">${names
        .map((s) => {
          const key = `${b.id}|${s}`;
          return chip({ action: "section", value: key, label: s, count: facets.sections[key] ?? 0, pressed: state.sections.includes(key) });
        })
        .join("")}</div></div>`;
    }).join("")
    : '<p class="hint">Kies eerst een boek om de hoofdstukken te zien.</p>';

  const tagged = ctx.data.books.filter((b) => ctx.tags.get(b.id)?.length);
  const tags = tagged.map((b) => `<div class="subgroup" style="--book:${e(b.color)}"><h4>${e(b.short)}</h4><div class="chip-wrap">${ctx.tags
    .get(b.id)
    .map((tag) => chip({
      action: "tag", value: tag, label: b.badges?.[tag] ? `${b.badges[tag]} · ${tag}` : tag,
      count: facets.tags[tag] ?? 0, pressed: state.tags.includes(tag),
    }))
    .join("")}</div></div>`).join("");

  const appliances = ctx.appliances
    .map((a) => chip({ action: "appliance", value: a, label: APPLIANCES[a] ?? a, count: facets.appliances[a] ?? 0, mode: state.appliances[a] }))
    .join("");

  const toggle = (flag, label, checked) => `
    <label class="toggle"><span>${label}</span><input type="checkbox" data-action="flag" data-value="${flag}"${checked ? " checked" : ""}></label>`;

  return `
    <section><h3>Boeken</h3><div class="books">${books}</div></section>
    <section><h3>Hoofdstukken</h3>${sections}</section>
    ${tags ? `<section><h3>Labels uit het boek</h3>${tags}</section>` : ""}
    <section><h3>Toestellen</h3><p class="hint">Eén tik: mét · twee tikken: zónder</p><div class="chip-wrap">${appliances}</div></section>
    <section><h3>Extra</h3>
      ${toggle("favorites", "♥ Alleen favorieten", state.favorites)}
      ${toggle("never", "Nog nooit gemaakt", state.never)}
      ${toggle("noAhead", "Niets op voorhand (geen nacht marineren…)", state.noAhead)}
    </section>`;
}
