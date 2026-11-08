#!/usr/bin/env node
// Episode 6 (Topic Clusters & Internal Linking): does this page link into its cluster well?
import {
  banner, stage, createReport, parseArgs, loadPage, elements, bodyText, jsonLdBlocks, schemaTypes, sameSite, c,
} from "../lib/core.mjs";

const USAGE = `Usage: cluster-wizard <url> [--fail-under N]

Checks one page of a topic cluster from Episode 6 of the Zero to Revenue SEO course:
how many internal links it has, whether their anchor text says where they lead, and
whether breadcrumbs show where the page sits. Run it on your pillar and on each spoke.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards cluster-wizard https://yourdomain.com/blog/your-pillar`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("TOPIC CLUSTER & INTERNAL LINK WIZARD (EPISODE 6)", target);
const page = await loadPage(target);
const html = page.body;

const links = elements(html, "a").filter((a) => {
  const href = (a.attrs.href || "").trim();
  return href && !/^(#|mailto:|tel:|javascript:)/i.test(href);
});
const internal = links.filter((a) => sameSite(a.attrs.href, page.url));

// 1. Internal links ───────────────────────────────────────────────────────────
stage("1. Internal links");
r.info(`${links.length} links: ${internal.length} internal, ${links.length - internal.length} external (navigation and footer included).`);
const uniqueInternal = new Set(internal.map((a) => new URL(a.attrs.href, page.url).pathname)).size;
if (uniqueInternal >= 10) r.pass(`Links to ${uniqueInternal} different pages on this site.`);
else if (uniqueInternal >= 5)
  r.warn(`Links to only ${uniqueInternal} different pages on this site.`, "Link this page to its pillar and to two or three sibling spokes from inside the text.", 10);
else
  r.fail(`Links to only ${uniqueInternal} different pages on this site.`, "Link this page to its pillar and to its sibling spokes with descriptive anchor text.", 25);

// 2. Anchor text ──────────────────────────────────────────────────────────────
stage("2. Anchor text");
const GENERIC = new Set(["click here", "here", "read more", "learn more", "more", "link", "this link", "view more", "this"]);
const generic = internal.filter((a) => GENERIC.has(a.text.toLowerCase()));
if (generic.length)
  r.warn(
    `${generic.length} internal link(s) say only "${[...new Set(generic.map((g) => g.text))].join('", "')}".`,
    "Rewrite them to name the page they lead to (\"boot sizing guide\", not \"read more\").",
    Math.min(generic.length * 5, 20),
  );
else if (internal.length) r.pass("No generic \"click here\" or \"read more\" internal anchors.");

// 3. Breadcrumbs ──────────────────────────────────────────────────────────────
stage("3. Breadcrumbs");
const types = schemaTypes(jsonLdBlocks(html));
const visual = /<nav\b[^>]*aria-label\s*=\s*["']breadcrumb/i.test(html) || /class\s*=\s*["'][^"']*breadcrumb/i.test(html);
if (visual || types.includes("BreadcrumbList"))
  r.pass(`Breadcrumbs found (${[visual && "on the page", types.includes("BreadcrumbList") && "BreadcrumbList schema"].filter(Boolean).join(" and ")}).`);
else r.warn("No breadcrumbs found.", "Add breadcrumbs (Home › Pillar › Spoke) so readers and crawlers see where each page sits.", 10);

// 4. Length ───────────────────────────────────────────────────────────────────
stage("4. Page length");
const words = bodyText(html).split(" ").filter(Boolean).length;
r.info(`About ${words} words of visible text, navigation included. (Length alone does not make a page useful.)`);
if (words < 400)
  r.warn("Under 400 words of visible text.", "If this is an article, cover the topic fully: the questions buyers ask, with steps and evidence.", 5);

r.finish("INTERNAL LINKING SCORE", flags);
console.log(c.dim("Next: Search Console → Links → Internal links. Your pillar should be near the top of Top linked pages.\n"));
