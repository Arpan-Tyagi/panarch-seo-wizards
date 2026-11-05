#!/usr/bin/env node
// Episode 3 (Programmatic Scaling): is a templated page unique enough to stand on its own?
import {
  banner, stage, createReport, parseArgs, fetchPage, linkHref, bodyText,
  jsonLdBlocks, schemaTypes, stripTrailingSlash, c,
} from "../lib/core.mjs";

const USAGE = `Usage: programmatic-wizard <url> [<sibling-url> ...] [--fail-under N]

Checks a templated (programmatic) page from Episode 3 of the Zero to Revenue SEO course:
clean URL, self-referencing canonical, structured data, breadcrumbs and page length.
Give two or more sibling pages built from the same template (for example two city
pages) and it also measures how much of their text is identical.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards programmatic-wizard \\
    https://yourdomain.com/locations/mumbai https://yourdomain.com/locations/delhi`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE, { multi: true });
const r = createReport();
banner("PROGRAMMATIC PAGE WIZARD (EPISODE 3)", urls.join("  "));

const pages = [];
for (const url of urls) {
  try {
    pages.push({ url, ...(await fetchPage(url)) });
  } catch (err) {
    r.fail(`Could not fetch ${url}: ${err.message}`, `Make ${url} reachable.`, 20);
  }
}
if (!pages.length) {
  r.finish("PROGRAMMATIC PAGE SCORE", flags);
  process.exit(process.exitCode ?? 1);
}

const first = pages[0];

// 1. Status and URL ───────────────────────────────────────────────────────────
stage("1. Status and URL");
for (const p of pages) {
  if (p.status === 200) r.pass(`${p.url} returns 200.`);
  else r.fail(`${p.url} returns HTTP ${p.status}.`, "Every generated page must return 200 directly, not through a redirect chain.", 20);
}
const u = new URL(first.url);
if (u.search) r.warn(`URL uses query parameters (${u.search}).`, "Use clean paths such as /locations/mumbai instead of ?city=mumbai.");
else r.pass(`Clean path: ${u.pathname}`);
if (/[A-Z_]/.test(u.pathname)) r.warn("Path contains capitals or underscores.", "Use lowercase words separated by hyphens.", 3);

// 2. Canonical ────────────────────────────────────────────────────────────────
stage("2. Canonical tag");
for (const p of pages) {
  const canonical = linkHref(p.body, "canonical");
  if (!canonical) {
    r.fail(`${p.url} has no canonical tag.`, "Give every generated page a canonical tag pointing to itself.", 15);
  } else if (stripTrailingSlash(new URL(canonical, p.url).href) === stripTrailingSlash(p.url)) {
    r.pass(`${p.url} points its canonical at itself.`);
  } else {
    r.warn(
      `${p.url} points its canonical at ${canonical}.`,
      "If each generated page should rank on its own, its canonical must point to itself, not to a parent page.",
      10,
    );
  }
}

// 3. Structured data and breadcrumbs ─────────────────────────────────────────
stage("3. Structured data and breadcrumbs");
const blocks = jsonLdBlocks(first.body);
const types = schemaTypes(blocks);
if (!blocks.length) r.warn("No JSON-LD structured data.", "Add LocalBusiness or Service schema built from the page's own data row.", 10);
else r.pass(`Schema types: ${types.join(", ") || "(none named)"}.`);
if (blocks.some((b) => !b.ok)) r.fail("A JSON-LD block is not valid JSON.", "Fix the JSON syntax in the template.", 10);
const hasBreadcrumb = types.includes("BreadcrumbList") || /aria-label\s*=\s*["']breadcrumb/i.test(first.body);
if (hasBreadcrumb) r.pass("Breadcrumbs found (link or schema).");
else r.warn("No breadcrumbs found.", "Add breadcrumbs (Home › Locations › Mumbai) so every generated page is linked from its parent.", 5);

// 4. Content depth and uniqueness ─────────────────────────────────────────────
stage("4. Content depth and uniqueness");
const texts = pages.map((p) => bodyText(p.body));
const words = texts[0].split(" ").filter(Boolean).length;
r.info(`${words} words of visible text on the first page. (Length alone does not make a page useful.)`);
if (words < 300)
  r.warn("Under 300 words of visible text.", "Add facts that are true only for this page: local prices, delivery times, real FAQs.", 10);

if (pages.length < 2) {
  r.info(c.dim("Tip: pass two or more sibling pages to measure how much text they share."));
} else {
  const shingles = texts.map((t) => shingleSet(t));
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const sim = Math.round(jaccard(shingles[i], shingles[j]) * 100);
      const label = `${new URL(pages[i].url).pathname} vs ${new URL(pages[j].url).pathname}: ${sim}% of 5-word phrases shared.`;
      if (sim >= 90)
        r.fail(label, "These pages are near-copies with a name swapped. Add data that is unique to each page, or merge them.", 20);
      else if (sim >= 70) r.warn(label, "Raise the share of text that comes from each page's own data row.", 10);
      else r.pass(label);
    }
  }
  console.log(c.dim("  Shared navigation, header and footer text counts too, so even good templates rarely score under 30%."));
}

r.finish("PROGRAMMATIC PAGE SCORE", flags);

function shingleSet(text, size = 5) {
  const w = text.toLowerCase().split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + size <= w.length; i++) set.add(w.slice(i, i + size).join(" "));
  return set;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const s of a) if (b.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}
