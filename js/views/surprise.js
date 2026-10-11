// "Verras me": a quick slot-machine shuffle that lands on one recipe.

import { COURSES, escapeHtml as e, plural, timeLabel } from "../format.js";
import { icon } from "../icons.js";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function openSurprise(ctx, pool, scopeText) {
  const dialog = document.getElementById("surprise");
  let pick = null;
  let spinning = false;

  const render = () => {
    dialog.innerHTML = `
      <div class="surprise-body">
        <button type="button" class="icon-button surprise-close" data-action="close" aria-label="Sluiten">${icon("close")}</button>
        <div class="surprise-photo photo" hidden></div>
        <div class="kicker">Vanavond eten we…</div>
        <div class="slot" aria-live="polite"><h2>…</h2></div>
        <div class="surprise-meta"></div>
        <div class="surprise-actions">
          <button type="button" class="button" data-action="again">${icon("dice")}Nog eentje</button>
          <button type="button" class="button primary" data-action="go" disabled>Deze wordt het!</button>
        </div>
        <p class="surprise-scope">${e(scopeText)}</p>
      </div>`;
  };

  const spin = async () => {
    if (spinning || !pool.length) return;
    spinning = true;
    const slot = dialog.querySelector(".slot");
    const title = slot.querySelector("h2");
    const meta = dialog.querySelector(".surprise-meta");
    const go = dialog.querySelector('[data-action="go"]');
    go.disabled = true;
    meta.innerHTML = "";
    const photo = dialog.querySelector(".surprise-photo");
    photo.hidden = true;
    photo.innerHTML = "";
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) while (next === pick) next = pool[Math.floor(Math.random() * pool.length)];
    pick = next;
    if (!reduceMotion() && pool.length > 1) {
      slot.className = "slot spinning";
      for (let i = 0, delay = 55; i < 14; i++, delay *= 1.16) {
        title.textContent = pool[Math.floor(Math.random() * pool.length)].title;
        title.style.animation = "none";
        void title.offsetWidth; // restart the flip animation
        title.style.animation = "";
        await wait(delay);
      }
    }
    slot.className = "slot landed";
    title.textContent = pick.title;
    if (pick.image) {
      photo.innerHTML = `<img src="${e(pick.image.src)}" alt="" decoding="async" referrerpolicy="no-referrer" data-photo>`;
      photo.hidden = false;
    }
    const ref = pick.refs[0];
    const book = ctx.books.get(ref.book);
    meta.style.setProperty("--book", book.color);
    meta.innerHTML = `<span><span class="dot"></span>${e(book.title)} · blz. ${ref.page}</span>
      <span>${e(COURSES[pick.course[0]])}</span><span>${icon("clock")}</span><span>${timeLabel(pick.time)}</span>`;
    meta.querySelectorAll(".icon").forEach((svg) => svg.setAttribute("style", "width:16px;height:16px;margin-right:-8px"));
    go.disabled = false;
    spinning = false;
  };

  render();
  dialog.onclick = (event) => {
    if (event.target === dialog) return dialog.close();
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close") dialog.close();
    if (action === "again") spin();
    if (action === "go" && pick) {
      dialog.close();
      ctx.navigate(`#/r/${pick.id}`);
    }
  };
  if (!pool.length) {
    dialog.querySelector(".slot h2").textContent = "Geen recepten met deze filters";
    dialog.querySelector('[data-action="again"]').disabled = true;
  }
  dialog.showModal();
  spin();
}

export function scopeLabel(count, total) {
  return count === total ? `Gekozen uit alle ${total} recepten.` : `Gekozen uit ${plural(count, "recept", "recepten")} die bij je filters passen.`;
}
