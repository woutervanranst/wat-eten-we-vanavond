// Dutch (Belgian) labels and formatting helpers.

export const COURSES = {
  hoofdgerecht: "Hoofdgerecht", voorgerecht: "Voorgerecht", soep: "Soep", salade: "Salade",
  bijgerecht: "Bijgerecht", hapje: "Hapje", lunch: "Lunch", brunch: "Brunch", ontbijt: "Ontbijt",
  tussendoor: "Tussendoortje", dessert: "Dessert", basis: "Saus & basis", drank: "Drankje",
};
export const COURSE_ORDER = Object.keys(COURSES);

export const DIETS = {
  vis: { label: "Vis", emoji: "🐟" },
  schaaldieren: { label: "Schaaldieren", emoji: "🦐" },
  vlees: { label: "Vlees", emoji: "🥩" },
  gevogelte: { label: "Gevogelte", emoji: "🍗" },
  vegetarisch: { label: "Vegetarisch", emoji: "🌱" },
};

export const APPLIANCES = {
  oven: "Oven", stoomoven: "Stoomoven", grill: "Grill", blender: "Blender",
  keukenmachine: "Keukenmachine", staafmixer: "Staafmixer", mixer: "Mixer", wok: "Wok",
  diepvries: "Diepvries", ijsmachine: "IJsmachine", thermomix: "Thermomix", airfryer: "Airfryer",
  microgolf: "Microgolf", wafelijzer: "Wafelijzer", sapcentrifuge: "Sapcentrifuge",
};

/** "3", "7,5": amounts in tickers. */
export function amountText(amount) {
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2))).replace(".", ",");
}

export function dietLabel(diet) {
  return DIETS[diet] ?? { label: diet, emoji: "" };
}

export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function minutesLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} u ${m}` : `${h} u`;
}

export function timeLabel(time) {
  return `${time.source === "estimated" ? "± " : ""}${minutesLabel(time.total)}`;
}

const SINGULAR = {
  koekjes: "koekje", "soufflés": "soufflé", kaastoastjes: "kaastoastje", toastjes: "toastje",
  "ronde toastjes": "rond toastje", glaasjes: "glaasje", shotjes: "shotje", crackers: "cracker",
  burgers: "burger", beignets: "beignet", rolletjes: "rolletje", repen: "reep", appelflappen: "appelflap",
  balletjes: "balletje", bolletjes: "bolletje", chocolaatjes: "chocolaatje", stuks: "stuk",
  bakvormpjes: "bakvormpje", "dikke plakken": "dikke plak", "kleine pannenkoekjes": "klein pannenkoekje",
};
const PLURAL = { taart: "taarten", cake: "cakes", brood: "broden", broodje: "broodjes", pot: "potten", potje: "potjes" };

/** "2 personen", "1 persoon", "1 taart", "2 taarten", "1 koekje", "10 koekjes". */
export function unitLabel(unit, amount) {
  if (unit === "personen") return amount === 1 ? "persoon" : "personen";
  if (amount === 1) return SINGULAR[unit] ?? unit;
  return PLURAL[unit] ?? unit;
}

const dateFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long" });
const dateYearFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric" });

export function dateLabel(iso, today) {
  if (iso === today) return "vandaag";
  const date = new Date(`${iso}T12:00:00`);
  return iso.slice(0, 4) === today.slice(0, 4) ? dateFormat.format(date) : dateYearFormat.format(date);
}

export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
