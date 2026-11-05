#!/usr/bin/env node
// Episode 1 (How Google Works): can Google reach, read and index this site?
import {
  banner, stage, createReport, parseArgs, fetchPage, metaContent, linkHref,
  elements, head, tags, c,
} from "../lib/core.mjs";

const USAGE = `Usage: seo-wizard <url> [--fail-under N]

Checks the crawl and indexing basics from Episode 1 of the Zero to Revenue SEO course:
HTTPS and redirects, robots.txt, the XML sitemap, and the homepage's indexing tags.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards seo-wizard https://yourdomain.com`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const origin = new URL(target).origin;
const r = createReport();

banner("SEO PRE-FLIGHT WIZARD (EPISODE 1)", target);

// 1. Domain and protocol ──────────────────────────────────────────────────────
stage("1. Domain, HTTPS and redirects");
let page;
try {
  page = await fetchPage(target);
} catch (err) {
  r.fail(`Could not connect: ${err.message}`, "Check the domain's DNS records and that the site is live.", 60);
  r.finish("SEO PRE-FLIGHT SCORE", flags);
  process.exit(process.exitCode ?? 1);
}

if (page.status === 200) r.pass(`Page responds with HTTP 200 (${page.headerMs}ms to first response).`);
else r.fail(`Page returned HTTP ${page.status}.`, `Make ${target} return 200 OK.`, 25);

if (new URL(page.url).protocol === "https:") r.pass("Served over HTTPS.");
else r.fail("Not served over HTTPS.", "Install a TLS certificate and redirect every http:// URL to https://.", 20);

const host = new URL(origin).hostname.replace(/^www\./, "");
const variants = [`http://${host}/`, `http://www.${host}/`, `https://${host}/`, `https://www.${host}/`];
const finals = new Set();
for (const v of variants) {
  try {
    const res = await fetch(v, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    finals.add(new URL(res.url).origin);
  } catch {
    // A variant that does not resolve (e.g. no www DNS record) is fine.
  }
}
if (finals.size <= 1) r.pass("All http/https and www/non-www versions end on one address.");
else
  r.warn(
    `${finals.size} different addresses serve the site: ${[...finals].join(", ")}.`,
    "Redirect every http and www variant to one preferred https address so Google sees one site, not several.",
  );

// 2. robots.txt ───────────────────────────────────────────────────────────────
stage("2. robots.txt");
let sitemapUrls = [];
try {
  const robots = await fetchPage(`${origin}/robots.txt`);
  if (robots.status !== 200) {
    r.warn(
      `robots.txt returned HTTP ${robots.status}. Google treats a missing file as "crawl everything".`,
      "Add a robots.txt that names your sitemap.",
    );
  } else {
    r.pass("robots.txt found.");
    const groups = parseRobots(robots.body);
    const rules = groupFor(groups, "googlebot") || groupFor(groups, "*");
    if (rules && rules.disallow.includes("/") && !rules.allow.includes("/")) {
      r.fail(
        "robots.txt blocks Googlebot from the whole site (Disallow: /).",
        "Remove 'Disallow: /' for User-agent: * (it is usually left over from a staging site).",
        40,
      );
    } else {
      r.pass("Googlebot is not blocked from the whole site.");
    }
    const blocksAssets = (rules?.disallow || []).filter((p) => /\/_next\/|\.js|\.css|\/assets\//i.test(p));
    if (blocksAssets.length)
      r.warn(
        `robots.txt blocks script or style files: ${blocksAssets.join(", ")}.`,
        "Unblock JS and CSS files. Google cannot render a page whose scripts it is not allowed to fetch.",
        10,
      );
    sitemapUrls = [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
    if (sitemapUrls.length) r.pass(`robots.txt names ${sitemapUrls.length} sitemap(s).`);
    else r.warn("robots.txt does not name a sitemap.", `Add the line 'Sitemap: ${origin}/sitemap.xml'.`);
  }
} catch (err) {
  r.warn(`Could not read robots.txt: ${err.message}`);
}

// 3. Sitemap ──────────────────────────────────────────────────────────────────
stage("3. XML sitemap");
const sitemapUrl = sitemapUrls[0] || `${origin}/sitemap.xml`;
try {
  const sm = await fetchPage(sitemapUrl);
  if (sm.status !== 200) {
    r.fail(
      `Sitemap ${sitemapUrl} returned HTTP ${sm.status}.`,
      "Publish an XML sitemap (Shopify and WordPress create one automatically) and submit it in Search Console.",
      20,
    );
  } else {
    const locs = (sm.body.match(/<loc>/gi) || []).length;
    const isIndex = /<sitemapindex\b/i.test(sm.body);
    if (locs === 0) r.warn(`Sitemap ${sitemapUrl} lists no URLs.`, "Fill the sitemap with your live public pages.", 15);
    else r.pass(`Sitemap found: ${locs} ${isIndex ? "child sitemaps (sitemap index)" : "URLs"}.`);
    if (locs > 50_000) r.fail("Sitemap has more than 50,000 entries, Google's per-file limit.", "Split it into several files under a sitemap index.", 10);
  }
} catch (err) {
  r.fail(`Could not read the sitemap: ${err.message}`, "Publish an XML sitemap at /sitemap.xml.", 20);
}

// 4. Indexing tags on the page ────────────────────────────────────────────────
stage("4. Indexing tags on the page");
const robotsMeta = [metaContent(page.body, "robots"), metaContent(page.body, "googlebot")].join(",");
const robotsHeader = page.headers.get("x-robots-tag") || "";
if (/noindex/i.test(robotsMeta) || /noindex/i.test(robotsHeader)) {
  r.fail(
    "The page carries 'noindex', so Google will drop it from search.",
    "Remove the noindex tag or header. On WordPress untick Settings → Reading → 'Discourage search engines'; on Shopify turn off the store password.",
    40,
  );
} else {
  r.pass("No 'noindex' tag or header.");
}

const title = elements(head(page.body), "title")[0]?.text || "";
if (!title) r.fail("No <title> tag.", "Add a title that starts with the page's main search phrase.", 15);
else if (title.length > 60)
  r.warn(`Title is ${title.length} characters: "${title}".`, "Aim for roughly 50–60 characters so the end is not cut off.");
else r.pass(`Title (${title.length} characters): "${title}"`);

const desc = metaContent(page.body, "description");
if (!desc) r.warn("No meta description.", "Write a 120–160 character description with a clear reason to click.", 10);
else if (desc.length > 160) r.warn(`Meta description is ${desc.length} characters; Google usually shows about 155–160.`, "Shorten the meta description.");
else r.pass(`Meta description (${desc.length} characters).`);

const canonical = linkHref(page.body, "canonical");
if (canonical) r.pass(`Canonical tag: ${canonical}`);
else r.warn("No canonical tag.", "Add <link rel=\"canonical\"> pointing to the page's preferred URL.");

if (tags(head(page.body), "meta").some((a) => (a.name || "").toLowerCase() === "viewport"))
  r.pass("Mobile viewport tag present.");
else
  r.fail("No mobile viewport tag; the page will render as a zoomed-out desktop page on phones.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.", 10);

r.finish("SEO PRE-FLIGHT SCORE", flags);
console.log(c.dim(`Next: search Google for site:${host}, and inspect a page in Search Console's URL Inspection.\n`));

// ── robots.txt parsing ───────────────────────────────────────────────────────
function parseRobots(text) {
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

function groupFor(groups, agent) {
  const hits = groups.filter((g) => g.agents.includes(agent));
  if (!hits.length) return null;
  return {
    allow: hits.flatMap((g) => g.allow),
    disallow: hits.flatMap((g) => g.disallow),
  };
}
