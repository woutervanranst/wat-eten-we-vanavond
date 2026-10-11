// Scaling ingredient templates ("{0} g kipfilet") to the chosen number of people.

const FRACTIONS = new Map([[0.25, "¼"], [0.5, "½"], [0.75, "¾"]]);
const MASS = new Set(["g", "ml"]);
const LARGE = new Set(["kg", "l"]);
const DECIMAL = new Set(["cl", "dl", "cm"]);
const SPOONS = new Set(["el", "tl"]);

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function decimal(value, digits = 2) {
  return Number(value.toFixed(digits)).toString().replace(".", ",");
}

function fraction(value) {
  const whole = Math.floor(value + 1e-9);
  const rest = Math.round((value - whole) * 100) / 100;
  if (rest === 0) return String(whole);
  const symbol = FRACTIONS.get(rest);
  if (!symbol) return decimal(value);
  return whole ? `${whole}${symbol}` : symbol;
}

/** Format a scaled quantity with rounding that suits its unit. */
export function formatQuantity(value, unit = "") {
  if (MASS.has(unit)) {
    if (value < 10) return decimal(Math.max(0.5, roundTo(value, 0.5)));
    if (value < 100) return String(roundTo(value, 5));
    if (value < 1000) return String(roundTo(value, 10));
    return String(roundTo(value, 50));
  }
  if (LARGE.has(unit)) return decimal(Math.max(0.05, roundTo(value, 0.05)));
  if (DECIMAL.has(unit)) return decimal(Math.max(0.5, roundTo(value, 0.5)));
  if (SPOONS.has(unit) || value < 1) return fraction(Math.max(0.25, roundTo(value, 0.25)));
  if (value < 10) return fraction(roundTo(value, 0.5));
  return String(Math.round(value));
}

/** How much to multiply the book's quantities by. */
export function factorFor(recipe, amount) {
  return amount / recipe.servings.count;
}

/** Number of people an amount stands for (for "per persoon" lines). */
export function peopleFor(recipe, amount) {
  const { servings } = recipe;
  if (servings.unit === "personen") return amount;
  return servings.serves ? (servings.serves * amount) / servings.count : amount;
}

// Singular <-> plural for the words that most often follow a scaled count.
const PLURALS = {
  eetlepel: "eetlepels", theelepel: "theelepels", koffielepel: "koffielepels", lepel: "lepels",
  teentje: "teentjes", takje: "takjes", stengel: "stengels", blik: "blikken", potje: "potjes",
  zakje: "zakjes", bosje: "bosjes", plakje: "plakjes", schijfje: "schijfjes", blaadje: "blaadjes",
  citroen: "citroenen", limoen: "limoenen", sinaasappel: "sinaasappels", appel: "appels", peer: "peren",
  banaan: "bananen", ui: "uien", sjalot: "sjalotten", sjalotje: "sjalotjes", ei: "eieren",
  tomaat: "tomaten", tomaatje: "tomaatjes", aubergine: "aubergines", courgette: "courgettes",
  paprika: "paprika's", wortel: "wortels", avocado: "avocado's", komkommer: "komkommers",
  prei: "preien", venkelknol: "venkelknollen", zalmfilet: "zalmfilets", kipfilet: "kipfilets",
  eidooier: "eidooiers", eiwit: "eiwitten", "lente-uitje": "lente-uitjes", chilipeper: "chilipepers",
};
const SINGULARS = Object.fromEntries(Object.entries(PLURALS).map(([one, many]) => [many, one]));

/** The number a formatted quantity shows: "1½" -> 1.5, "¾" -> 0.75, "7,5" -> 7.5. */
function shown(text) {
  const fraction = { "¼": 0.25, "½": 0.5, "¾": 0.75 }[text.slice(-1)] ?? 0;
  const whole = fraction ? text.slice(0, -1) : text;
  return (whole ? Number(whole.replace(",", ".")) : 0) + fraction;
}

/** "2 eetlepel" -> "2 eetlepels", "1 wortels" -> "1 wortel" (next word after a count). */
function agree(text, value) {
  return text.replace(/^(\s+(?:(?:grote|kleine|flinke|middelgrote|rijpe|rode|gele|groene)\s+)?)([\p{L}'-]+)/u, (m, lead, word) => {
    const lower = word.toLowerCase();
    if (value > 1 && PLURALS[lower]) return lead + PLURALS[lower];
    if (value <= 1 && SINGULARS[lower]) return lead + SINGULARS[lower];
    return m;
  });
}

/**
 * Render one ingredient item as segments: plain strings and {qty} objects for
 * scaled numbers. At factor 1 the book's original text is returned untouched.
 */
export function renderItem(item, factor) {
  if (!item.q || Math.abs(factor - 1) < 1e-9) return [item.o ?? item.t];
  const segments = [];
  const matches = [...item.t.matchAll(/\{(\d+)\}/g)];
  let last = 0;
  matches.forEach((m, i) => {
    if (m.index > last) segments.push(item.t.slice(last, m.index));
    const index = Number(m[1]);
    const qty = formatQuantity(item.q[index] * factor, item.u[index]);
    const value = shown(qty);
    segments.push({ qty });
    last = m.index + m[0].length;
    // Only the word right after the last number of a range follows its count.
    const end = i + 1 < matches.length ? matches[i + 1].index : item.t.length;
    const following = item.t.slice(last, end);
    if (!/^\s*[-–à]/.test(following) && !/^\s*(?:tot|of)\s/.test(following)) {
      segments.push(agree(following, value));
      last = end;
    }
  });
  if (last < item.t.length) segments.push(item.t.slice(last));
  return segments;
}

export function itemText(item, factor) {
  return renderItem(item, factor).map((s) => (typeof s === "string" ? s : s.qty)).join("");
}

/** Total for a "per persoon" line, e.g. 100 g sobanoedels per persoon x 3 = 300 g. */
export function perPersonTotal(item, people) {
  if (!item.pp) return null;
  const [value, unit] = item.pp;
  return { qty: formatQuantity(value * people, unit), unit };
}
