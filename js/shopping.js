// Merge the ingredients of the planned recipes into one shopping list.

import { factorFor, formatQuantity, itemText, peopleFor } from "./scale.js";

const UNIT_LABELS = {
  g: ["g", "g"], kg: ["kg", "kg"], ml: ["ml", "ml"], cl: ["cl", "cl"], dl: ["dl", "dl"], l: ["l", "l"],
  el: ["el", "el"], tl: ["tl", "tl"], teen: ["teentje", "teentjes"], takje: ["takje", "takjes"],
  handvol: ["handvol", "handvol"], blik: ["blik", "blikken"], bos: ["bos", "bosjes"],
  pot: ["potje", "potjes"], pak: ["pak", "pakken"], zak: ["zak", "zakken"], stuk: ["stuk", "stuks"],
  cm: ["cm", "cm"],
};

/** "2 stengels bleekselderij, in blokjes (90 g)" -> "2 stengels bleekselderij": no cooking notes. */
export function shortLabel(text) {
  // A comma followed by a digit is a decimal comma ("7,5 g"), not a separator.
  return text.split(/(?:[:;]|,(?!\d))(?![^()]*\))/)[0].replace(/\s*\((?:zie|voor de|bv\.)[^)]*\)/g, "").trim();
}

// Sum in one base unit per dimension, so 300 g + 0,5 kg becomes 800 g.
const BASE = { kg: ["g", 1000], cl: ["ml", 10], dl: ["ml", 100], l: ["ml", 1000] };

function toBase(value, unit) {
  const [base, factor] = BASE[unit] ?? [unit, 1];
  return [value * factor, base];
}

function fromBase(value, unit) {
  if (unit === "g" && value >= 1000) return [value / 1000, "kg"];
  if (unit === "ml" && value >= 1000) return [value / 1000, "l"];
  return [value, unit];
}

function amountLabel(baseValue, baseUnit) {
  const [value, unit] = fromBase(baseValue, baseUnit);
  const qty = formatQuantity(value, unit);
  if (!unit) return `${qty} ×`;
  const [one, many] = UNIT_LABELS[unit] ?? [unit, unit];
  return `${qty} ${value > 1 ? many : one}`;
}

/**
 * entries: [{ id, amount }]; recipes: Map id -> recipe.
 * Returns [{ key, label, details: [{ text, title }], pantry }] sorted by label.
 */
export function shoppingList(entries, recipes) {
  const lines = new Map();
  for (const entry of entries) {
    const recipe = recipes.get(entry.id);
    if (!recipe) continue;
    const factor = factorFor(recipe, entry.amount);
    const people = peopleFor(recipe, entry.amount);
    for (const group of recipe.ingredients) {
      for (const item of group.items) {
        const name = (item.n ?? []).join(" + ");
        const key = name || item.t;
        const line = lines.get(key) ?? { key, name, pantry: Boolean(item.p), sums: new Map(), details: [], summable: true };
        lines.set(key, line);
        let text = shortLabel(itemText(item, factor));
        if (item.pp) {
          const [value, unit] = item.pp;
          const [amount, base] = toBase(value * people, unit);
          line.sums.set(base, (line.sums.get(base) ?? 0) + amount);
          text = `${formatQuantity(value * people, unit)}${unit ? ` ${unit}` : ""} ${line.name || shortLabel(item.t)}`;
        } else if (item.q?.length === 1) {
          const [amount, base] = toBase(item.q[0] * factor, item.u[0]);
          line.sums.set(base, (line.sums.get(base) ?? 0) + amount);
        } else {
          line.summable = false;
        }
        line.details.push({ text, title: recipe.title });
      }
    }
  }
  return [...lines.values()]
    .map((line) => {
      let label;
      if (line.details.length === 1) label = line.details[0].text;
      else if (line.summable && line.sums.size && line.name) {
        label = `${[...line.sums].map(([unit, value]) => amountLabel(value, unit)).join(" + ")} ${line.name}`;
      } else label = line.name || line.key;
      return { key: line.key, label, details: line.details, pantry: line.pantry };
    })
    .sort((a, b) => a.key.localeCompare(b.key, "nl"));
}

export function asText(list, title = "Boodschappenlijst") {
  const toBuy = list.filter((l) => !l.pantry).map((l) => `• ${l.label}`);
  const pantry = list.filter((l) => l.pantry).map((l) => `• ${l.label}`);
  return [title, "", ...toBuy, ...(pantry.length ? ["", "Check of je dit in huis hebt:", ...pantry] : [])].join("\n");
}
