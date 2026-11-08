#!/usr/bin/env node
// Episode 2 (The Anatomy of a Perfect Web Page): on-page checks for one URL.
import {
  banner, stage, createReport, parseArgs, loadPage, metaContent, linkHref,
  elements, head, tags, jsonLdBlocks, schemaTypes, sameSite,
} from "../lib/core.mjs";

const USAGE = `Usage: onpage-wizard <url> [--fail-under N]

Checks the on-page basics from Episode 2 of the Zero to Revenue SEO course:
title, meta description, headings, image alt text, link anchors, social tags,
canonical tag and structured data.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards onpage-wizard https://yourdomain.com/products/boots`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("ON-PAGE WIZARD (EPISODE 2)", target);

const page = await loadPage(target);
if (page.status !== 200) r.fail(`Page returned HTTP ${page.status}.`, "Audit a live page that returns 200.", 20);

const html = page.body;
const hd = head(html);

// 1. Title ────────────────────────────────────────────────────────────────────
stage("1. Title tag");
const title = elements(hd, "title")[0]?.text || "";
if (!title) {
  r.fail("No <title> tag.", "Add a title: [main search phrase] - [proof or benefit] | [brand].", 15);
} else {
  r.info(`"${title}" (${title.length} characters)`);
  if (title.length > 60) r.warn("Longer than about 60 characters; the end will probably be cut off on mobile.", "Move the search phrase to the front and trim the title.");
  else if (title.length < 30) r.warn("Very short title; there is room to add a benefit or your brand.", "Expand the title to roughly 50–60 characters.");
  else r.pass("Title length is in the usual safe range. (Google can still rewrite any title.)");
}

// 2. Meta description ─────────────────────────────────────────────────────────
stage("2. Meta description");
const desc = metaContent(html, "description");
if (!desc) r.fail("No meta description.", "Write 120–160 characters: the customer's problem, your answer, a call to action.", 10);
else if (desc.length > 160) r.warn(`${desc.length} characters; Google usually shows about 155–160.`, "Shorten the meta description.");
else if (desc.length < 110) r.warn(`Only ${desc.length} characters.`, "Use the space: add proof or a call to action.", 3);
else r.pass(`${desc.length} characters.`);

// 3. Headings ─────────────────────────────────────────────────────────────────
stage("3. Headings");
const levels = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => Number(m[1]));
const h1s = elements(html, "h1");
if (h1s.length === 1) r.pass(`One H1: "${h1s[0].text}"`);
else if (h1s.length === 0) r.fail("No H1 heading.", "Give the page one visible H1 that matches the title's topic.", 15);
else
  r.warn(
    `${h1s.length} H1 headings: ${h1s.map((h) => `"${h.text}"`).join(", ")}.`,
    "Keep one H1 for the page's main topic. Google allows several, but one is clearer for readers and screen readers.",
  );
const skips = levels.filter((lvl, i) => i > 0 && lvl > levels[i - 1] + 1).length;
if (skips) r.warn(`Heading levels skip ${skips} time(s) (for example H2 straight to H4).`, "Use heading levels in order: H1, then H2, then H3.", 3);
else if (levels.length) r.pass("Heading levels are in order.");

// 4. Images ───────────────────────────────────────────────────────────────────
stage("4. Images");
const imgs = tags(html, "img");
if (!imgs.length) {
  r.info("No <img> elements on the page.");
} else {
  const missingAlt = imgs.filter((a) => !("alt" in a));
  const emptyAlt = imgs.filter((a) => "alt" in a && !a.alt.trim());
  const modern = imgs.filter((a) => /\.(avif|webp|svg)(\?|$)|\/_next\/image|format=(avif|webp)/i.test(`${a.src || ""} ${a.srcset || ""}`));
  r.info(`${imgs.length} images; ${modern.length} in AVIF, WebP or SVG (or served through an image optimiser).`);
  if (missingAlt.length)
    r.fail(`${missingAlt.length} image(s) have no alt attribute at all.`, "Describe each product image as you would over the phone; use alt=\"\" only for pure decoration.", 10);
  else r.pass("Every image has an alt attribute.");
  if (emptyAlt.length) r.info(`${emptyAlt.length} image(s) use alt="" (correct only for decorative images).`);
}

// 5. Links ────────────────────────────────────────────────────────────────────
stage("5. Links and anchor text");
const GENERIC = new Set(["click here", "here", "read more", "learn more", "more", "link", "view", "this"]);
const links = elements(html, "a").filter((a) => a.attrs.href && !a.attrs.href.startsWith("#"));
const internal = links.filter((a) => sameSite(a.attrs.href, target));
const generic = links.filter((a) => GENERIC.has(a.text.toLowerCase()));
r.info(`${links.length} links: ${internal.length} internal, ${links.length - internal.length} external.`);
if (generic.length)
  r.warn(
    `${generic.length} link(s) say only "${[...new Set(generic.map((g) => g.text))].join('", "')}".`,
    "Rewrite generic anchors to say where they lead (\"compare our boot sizes\", not \"click here\").",
  );
else r.pass("No generic \"click here\" anchors.");
if (internal.length < 3) r.warn("Fewer than 3 internal links.", "Link to related products, guides and your main category pages.", 3);

// 6. Social and canonical ─────────────────────────────────────────────────────
stage("6. Social preview and canonical");
for (const key of ["og:title", "og:description", "og:image"]) {
  if (metaContent(html, key)) r.pass(`${key} present.`);
  else r.warn(`${key} missing; link previews on WhatsApp, LinkedIn and X will be poorer.`, `Add a <meta property="${key}"> tag.`, 3);
}
const canonical = linkHref(html, "canonical");
if (canonical) r.pass(`Canonical: ${canonical}`);
else r.warn("No canonical tag.", "Add <link rel=\"canonical\"> pointing to this page's preferred URL.", 10);

// 7. Structured data ──────────────────────────────────────────────────────────
stage("7. Structured data (JSON-LD)");
const blocks = jsonLdBlocks(html);
const broken = blocks.filter((b) => !b.ok);
if (!blocks.length) r.warn("No JSON-LD structured data.", "Add Product, Article or Organization schema; check it in Google's Rich Results Test.", 5);
else r.pass(`Schema types: ${schemaTypes(blocks).join(", ") || "(none named)"}.`);
if (broken.length) r.fail(`${broken.length} JSON-LD block(s) are not valid JSON.`, "Fix the JSON syntax; Google ignores broken blocks.", 10);

r.finish("ON-PAGE SCORE", flags);
