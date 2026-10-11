// Dutch-aware text matching for ingredient search ("tomaat" finds "tomaten",
// "kip" finds "kippendijen" but not "kippenbouillon").

const DERIVED = "bouillon|fond|puree|concentraat|poeder|saus|olie|azijn|meel|gras|siroop|extract";
const DERIVED_RE = new RegExp(`^(?:pen|en|e|s|n)?(?:${DERIVED})`);
const SUFFIXES = ["etjes", "tjes", "pjes", "jes", "etje", "tje", "pje", "je", "'s", "eren", "en", "s"];
const SPECIAL = { uien: "ui", uitjes: "ui", eieren: "ei", eitjes: "ei" };
const VOWELS = "aeiou";

export function fold(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function singular(word) {
  if (SPECIAL[word]) return { base: SPECIAL[word], stripped: true };
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return { base: word.slice(0, -suffix.length), stripped: true };
    }
  }
  return { base: word, stripped: false };
}

function isConsonant(c) {
  return c && !VOWELS.includes(c) && /[a-z]/.test(c);
}

/** Regex sources that each indicate a match for the (folded) query. */
export function variants(query) {
  const words = fold(query).split(" ");
  const last = words.pop();
  const head = words.length ? `${words.join(" ")} ` : "";
  const { base, stripped } = singular(last);
  const out = [escape(head + base)];
  const n = base.length;
  // tomaat -> "tomat" before an e (tomaten); kaas -> "kas" before e only.
  if (n >= 3 && isConsonant(base[n - 1]) && base[n - 2] === base[n - 3] && VOWELS.includes(base[n - 2])) {
    out.push(`${escape(head + base.slice(0, n - 2) + base[n - 1])}(?=e)`);
  }
  // tomat (from tomaten) -> also "tomaat".
  if (stripped && n >= 3 && isConsonant(base[n - 1]) && VOWELS.includes(base[n - 2]) && isConsonant(base[n - 3])) {
    out.push(escape(head + base.slice(0, n - 1) + base[n - 2] + base[n - 1]));
  }
  // olijf -> olijven, druif -> druiven.
  if (base.endsWith("f")) out.push(`${escape(head + base.slice(0, -1))}v(?=en)`);
  return out;
}

/**
 * Build a matcher for one search term. Short terms (<= 3 letters) only match at the
 * start of a word (3 letters: also at the end), so "ui" finds "rode ui" and
 * "lente-ui" but not "fruit".
 */
export function matcher(query) {
  const folded = fold(query);
  const length = singular(folded.split(" ").pop()).base.length;
  const short = length <= 3;
  const sources = variants(folded);
  const regexes = sources.map((s) => new RegExp(short ? `(?:^|[\\s-])${s}` : s, "g"));
  // "scharrelkip": compounds ending in the term; not for 2-letter terms ("prei" is no "ei").
  const endRegexes = short && length === 3 ? sources.map((s) => new RegExp(`${s}(?:en|s|tjes|jes)?(?=$|[\\s-])`, "g")) : [];
  return (text) => {
    for (const re of [...regexes, ...endRegexes]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const rest = text.slice(m.index + m[0].length).split(/[\s-]/)[0];
        if (!DERIVED_RE.test(rest)) return true;
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    return false;
  };
}
