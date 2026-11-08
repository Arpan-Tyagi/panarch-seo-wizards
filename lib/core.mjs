// Shared helpers for the Panarch SEO wizards. Zero dependencies; Node 18+.

const USER_AGENT =
  "panarch-seo-wizards/1.0 (+https://github.com/Arpan-Tyagi/panarch-seo-wizards)";
const TIMEOUT_MS = 20_000;

// ── Terminal output ──────────────────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  cyan: paint("36"),
  copper: paint("38;2;217;161;141"),
};

export function banner(title, target) {
  const line = "─".repeat(68);
  console.log(`\n${c.copper(line)}\n${c.bold(c.copper(`  PANARCH DIGITAL // ${title}`))}\n${c.copper(line)}`);
  console.log(`${c.dim("Target:")} ${c.cyan(target)}\n`);
}

export function stage(title) {
  console.log(`\n${c.bold(`── ${title} `)}${c.dim("─".repeat(Math.max(4, 60 - title.length)))}`);
}

/**
 * A scorecard: each check either passes, warns or fails, and deducts points.
 * Scores are a checklist heuristic, not a Google signal.
 */
export function createReport() {
  let score = 100;
  const fixes = [];
  return {
    pass: (msg) => console.log(`  ${c.green("✔ PASS")} ${msg}`),
    info: (msg) => console.log(`  ${c.cyan("ℹ INFO")} ${msg}`),
    warn: (msg, fix, points = 5) => {
      console.log(`  ${c.yellow("⚠ WARN")} ${msg}`);
      if (fix) fixes.push(fix);
      score -= points;
    },
    fail: (msg, fix, points = 15) => {
      console.log(`  ${c.red("✖ FAIL")} ${msg}`);
      if (fix) fixes.push(fix);
      score -= points;
    },
    get score() {
      return Math.max(0, score);
    },
    finish(label, { failUnder } = {}) {
      const final = Math.max(0, score);
      const colour = final >= 85 ? c.green : final >= 65 ? c.yellow : c.red;
      console.log(`\n${c.copper("─".repeat(68))}`);
      console.log(`  ${c.bold(`${label}: `)}${c.bold(colour(`${final} / 100`))}`);
      console.log(c.dim("  (A checklist score from this tool, not a Google ranking signal.)"));
      console.log(c.copper("─".repeat(68)));
      if (fixes.length) {
        console.log(`\n${c.bold("What to fix, in order:")}`);
        fixes.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      } else {
        console.log(`\n  ${c.green("Nothing to fix in this checklist.")}`);
      }
      console.log("");
      if (failUnder !== undefined && final < failUnder) process.exitCode = 1;
      return final;
    },
  };
}

// ── Arguments ────────────────────────────────────────────────────────────────
/**
 * Parses `<url> [more urls] [--fail-under N] [--no-psi]`.
 * Exits with usage text when no URL is given.
 */
export function parseArgs(argv, usage, { multi = false } = {}) {
  const urls = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(usage);
      process.exit(0);
    } else if (a === "--fail-under") {
      flags.failUnder = Number(argv[++i]);
    } else if (a.startsWith("--")) {
      flags[a.slice(2)] = true;
    } else {
      urls.push(normalizeUrl(a));
    }
  }
  if (urls.length === 0 || (!multi && urls.length > 1)) {
    console.error(usage);
    process.exit(2);
  }
  return { urls, flags };
}

export function normalizeUrl(input) {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    console.error(`Not a valid URL: ${input}`);
    process.exit(2);
  }
}

// ── Network ──────────────────────────────────────────────────────────────────
/** Fetches a URL and returns status, headers, body text and elapsed time. */
export async function fetchPage(url, { redirect = "follow" } = {}) {
  const started = performance.now();
  const res = await fetch(url, {
    redirect,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*" },
  });
  const headersAt = performance.now();
  const body = await res.text();
  return {
    url: res.url || url,
    status: res.status,
    headers: res.headers,
    body,
    headerMs: Math.round(headersAt - started),
    totalMs: Math.round(performance.now() - started),
  };
}

// ── Stopping a run ───────────────────────────────────────────────────────────
// process.exit() while fetch sockets are still closing can crash Node on Windows
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). A wizard stops by
// throwing StopRun; this handler turns that into exit code 1 once the event loop drains.
class StopRun extends Error {}
process.on("uncaughtException", (err) => {
  if (!(err instanceof StopRun)) console.error(err);
  process.exitCode = 1;
});

/** Prints why the run cannot continue and stops it without a score. */
export function stop(message) {
  console.error(`  ${c.red("✖ STOPPED")} ${message}\n`);
  throw new StopRun(message);
}

function describeFetchError(err) {
  if (err.name === "TimeoutError") return `no response within ${TIMEOUT_MS / 1000} seconds`;
  const code = err.cause?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "the domain does not resolve";
  if (code === "ECONNREFUSED") return "the server refused the connection";
  return err.cause?.message || err.message;
}

/**
 * Fetches the page a wizard audits. Stops the run, without a score, when the page is
 * unreachable, returns an error status or is not HTML: scoring an error page or a file
 * would print a misleading report.
 */
export async function loadPage(url) {
  let page;
  try {
    page = await fetchPage(url);
  } catch (err) {
    stop(`Could not reach ${url}: ${describeFetchError(err)}.`);
  }
  if (page.status >= 400) stop(`${url} returned HTTP ${page.status}. Run the wizard on a live page that returns 200.`);
  const type = page.headers.get("content-type") || "";
  if (type && !/html/i.test(type)) stop(`${url} is not an HTML page (content-type: ${type}).`);
  return page;
}

// ── HTML parsing (regex-based; good enough for server-rendered HTML) ────────
const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

export function parseAttrs(raw) {
  const attrs = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Every opening tag of `name` as an attribute object. */
export function tags(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  return [...html.matchAll(re)].map((m) => parseAttrs(m[1]));
}

/** Inner text of every `name` element (e.g. h1, a, title). */
export function elements(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}>`, "gi");
  return [...html.matchAll(re)].map((m) => ({ attrs: parseAttrs(m[1]), text: textOf(m[2]) }));
}

export function head(html) {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html;
}

export function metaContent(html, key) {
  const k = key.toLowerCase();
  const hit = tags(head(html), "meta").find(
    (a) => (a.name || "").toLowerCase() === k || (a.property || "").toLowerCase() === k,
  );
  return hit ? (hit.content || "").trim() : "";
}

export function linkHref(html, rel) {
  const hit = tags(head(html), "link").find((a) =>
    (a.rel || "").toLowerCase().split(/\s+/).includes(rel),
  );
  return hit ? hit.href || "" : "";
}

export function textOf(fragment) {
  return decodeEntities(
    fragment
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function bodyText(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return textOf(m ? m[1] : html);
}

export function jsonLdBlocks(html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  return [...html.matchAll(re)].map((m) => {
    try {
      return { ok: true, data: JSON.parse(m[1].trim()) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/** Flattens JSON-LD (arrays and @graph) into a list of @type names. */
export function schemaTypes(blocks) {
  const types = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (node["@type"]) types.push(...[].concat(node["@type"]));
    if (node["@graph"]) visit(node["@graph"]);
  };
  blocks.filter((b) => b.ok).forEach((b) => visit(b.data));
  return types;
}

/** Every JSON-LD node (objects inside arrays and @graph), for reading @id, sameAs and links. */
export function jsonLdNodes(blocks) {
  const nodes = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    if (node["@graph"]) visit(node["@graph"]);
  };
  blocks.filter((b) => b.ok).forEach((b) => visit(b.data));
  return nodes.filter((n) => n["@type"] || n["@id"]);
}

// ── robots.txt ───────────────────────────────────────────────────────────────
/** Groups robots.txt rules by user-agent (consecutive User-agent lines share one group). */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], allow: [], disallow: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "allow" && value) current.allow.push(value);
      if (key === "disallow" && value) current.disallow.push(value);
    }
  }
  return groups;
}

/** The merged rules of every group that names `agent`, or null when none does. */
export function groupFor(groups, agent) {
  const hits = groups.filter((g) => g.agents.includes(agent.toLowerCase()));
  if (!hits.length) return null;
  return {
    allow: hits.flatMap((g) => g.allow),
    disallow: hits.flatMap((g) => g.disallow),
  };
}

/** True when robots.txt keeps `agent` out of the whole site (its own group, else the * group). */
export function blocksWholeSite(groups, agent) {
  const rules = groupFor(groups, agent) || groupFor(groups, "*");
  return Boolean(rules && rules.disallow.includes("/") && !rules.allow.includes("/"));
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (whole, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

export function sameSite(href, base) {
  try {
    return new URL(href, base).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

export function stripTrailingSlash(u) {
  return u.replace(/\/+$/, "");
}
