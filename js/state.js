// Filter state <-> URL query (shareable links like #/?q=zalm&gang=hoofdgerecht&max=45).

export const SORTS = ["verrassend", "snelst", "lang", "boek"];

export function emptyState() {
  return {
    terms: [], // [{ text, without }]
    pantryMode: false, // "Wat heb ik in huis?": rank instead of requiring every term
    diet: [],
    course: [],
    books: [],
    sections: [], // "bookId|Section"
    tags: [],
    appliances: {}, // { oven: "met" | "zonder" }
    max: null, // minutes, null = no limit
    noAhead: false,
    favorites: false,
    never: false,
    sort: "verrassend",
  };
}

export function fromQuery(query) {
  const params = new URLSearchParams(query);
  const state = emptyState();
  for (const value of params.getAll("q")) {
    const without = value.startsWith("-");
    const text = (without ? value.slice(1) : value).trim();
    if (text) state.terms.push({ text, without });
  }
  state.pantryMode = params.get("huis") === "1";
  state.diet = params.getAll("dieet");
  state.course = params.getAll("gang");
  state.books = params.getAll("boek");
  state.sections = params.getAll("sectie");
  state.tags = params.getAll("tag");
  for (const value of params.getAll("toestel")) {
    if (value.startsWith("-")) state.appliances[value.slice(1)] = "zonder";
    else state.appliances[value] = "met";
  }
  const max = Number(params.get("max"));
  state.max = Number.isFinite(max) && max > 0 ? max : null;
  state.noAhead = params.get("voorhand") === "0";
  state.favorites = params.get("fav") === "1";
  state.never = params.get("nooit") === "1";
  const sort = params.get("sort");
  state.sort = SORTS.includes(sort) ? sort : "verrassend";
  return state;
}

export function toQuery(state) {
  const params = new URLSearchParams();
  for (const term of state.terms) params.append("q", `${term.without ? "-" : ""}${term.text}`);
  if (state.pantryMode) params.set("huis", "1");
  for (const v of state.diet) params.append("dieet", v);
  for (const v of state.course) params.append("gang", v);
  for (const v of state.books) params.append("boek", v);
  for (const v of state.sections) params.append("sectie", v);
  for (const v of state.tags) params.append("tag", v);
  for (const [name, mode] of Object.entries(state.appliances)) {
    params.append("toestel", mode === "zonder" ? `-${name}` : name);
  }
  if (state.max) params.set("max", String(state.max));
  if (state.noAhead) params.set("voorhand", "0");
  if (state.favorites) params.set("fav", "1");
  if (state.never) params.set("nooit", "1");
  if (state.sort !== "verrassend") params.set("sort", state.sort);
  return params.toString();
}

/** Number of active filters, for the "Meer filters" badge (sheet-only filters). */
export function sheetFilterCount(state) {
  return (
    state.books.length + state.sections.length + state.tags.length +
    Object.keys(state.appliances).length + (state.favorites ? 1 : 0) + (state.never ? 1 : 0) +
    (state.noAhead ? 1 : 0)
  );
}

export function isEmpty(state) {
  return toQuery({ ...state, sort: "verrassend" }) === "";
}
