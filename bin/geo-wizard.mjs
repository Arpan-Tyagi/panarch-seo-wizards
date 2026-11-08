#!/usr/bin/env node
// Episode 5 (GEO & Entity Schema): can AI search tools read who you are and quote your page?
import {
  banner, stage, createReport, parseArgs, loadPage, fetchPage, elements, jsonLdBlocks,
  jsonLdNodes, schemaTypes, parseRobots, blocksWholeSite, c,
} from "../lib/core.mjs";

const USAGE = `Usage: geo-wizard <url> [--fail-under N]

Checks the entity and AI-search basics from Episode 5 of the Zero to Revenue SEO course:
connected JSON-LD (@graph and @id links, Organization and sameAs), whether AI search
crawlers may crawl the site, the optional /llms.txt file, and short answer paragraphs.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards geo-wizard https://yourdomain.com`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("GEO & ENTITY SCHEMA WIZARD (EPISODE 5)", target);
const page = await loadPage(target);
const html = page.body;
const origin = new URL(page.url).origin;

// 1. Structured data ──────────────────────────────────────────────────────────
stage("1. Connected structured data (JSON-LD)");
const blocks = jsonLdBlocks(html);
const nodes = jsonLdNodes(blocks);
const types = schemaTypes(blocks);
if (!blocks.length) {
  r.fail("No JSON-LD on this page; search engines must guess your facts from the text.", "Add an Organization (or LocalBusiness) node and a node for this page's main thing, in one @graph.", 25);
} else {
  r.info(`Schema types: ${types.join(", ") || "(none named)"}.`);
  if (blocks.some((b) => !b.ok)) r.fail("A JSON-LD block is not valid JSON; Google ignores it.", "Fix the JSON syntax, then re-test in the Schema Markup Validator.", 10);
  if (blocks.some((b) => b.ok && b.data?.["@graph"])) r.pass("Uses one connected @graph.");
  else r.warn("Separate JSON-LD blocks with no @graph.", "Put the nodes in one @graph so it is clear they describe the same business.", 5);

  const ids = new Set(nodes.map((n) => n["@id"]).filter(Boolean));
  const linked = nodes.some((n) =>
    Object.entries(n).some(([k, v]) => k !== "@id" && [].concat(v).some((x) => x && typeof x === "object" && ids.has(x["@id"]))),
  );
  if (linked) r.pass("Nodes are linked by @id (for example a brand, publisher or seller pointing at the Organization).");
  else if (ids.size) r.warn("Nodes have @id values but none points at another.", "Reference the Organization's @id from the other nodes (brand, publisher, seller, provider).", 10);
  else r.warn("No @id values, so nodes cannot point at each other.", "Give each node a stable @id such as https://yourdomain.com/#organization.", 10);

  const org = nodes.find((n) => [].concat(n["@type"] || []).some((t) => /Organization|LocalBusiness|Store|Corporation/i.test(t)));
  if (!org) {
    r.warn("No Organization or LocalBusiness node.", "Add one with your legal name, logo, url and sameAs links.", 10);
  } else {
    const sameAs = [].concat(org.sameAs || []);
    if (sameAs.length) r.pass(`${org.name ? `"${org.name}"` : "Organization"} lists ${sameAs.length} sameAs profile(s).`);
    else r.warn("The Organization node has no sameAs links.", "List the official profiles you own (LinkedIn, Instagram, Crunchbase, Wikidata if you have an entry).", 5);
  }
}

// 2. AI crawler access ────────────────────────────────────────────────────────
stage("2. AI crawler access (robots.txt)");
const SEARCH_BOTS = ["OAI-SearchBot", "PerplexityBot"];
const TRAINING_BOTS = ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot"];
try {
  const robots = await fetchPage(`${origin}/robots.txt`);
  if (robots.status !== 200) {
    r.info(`No robots.txt (HTTP ${robots.status}), so every crawler may crawl the site.`);
  } else {
    const groups = parseRobots(robots.body);
    const blockedSearch = SEARCH_BOTS.filter((b) => blocksWholeSite(groups, b));
    if (!blockedSearch.length) r.pass(`AI search crawlers (${SEARCH_BOTS.join(", ")}) may crawl the site.`);
    for (const bot of blockedSearch)
      r.warn(`${bot} is blocked from the whole site.`, `Allow ${bot} in robots.txt if you want to be cited in its AI search answers.`, 10);
    const blockedTraining = TRAINING_BOTS.filter((b) => blocksWholeSite(groups, b));
    r.info(
      blockedTraining.length
        ? `Training crawlers blocked: ${blockedTraining.join(", ")}. That is a business choice and does not affect search citations.`
        : "No AI training crawlers are blocked. Blocking them is a business choice; it does not affect search citations.",
    );
  }
} catch (err) {
  r.info(`Could not read robots.txt (${err.message}).`);
}

// 3. llms.txt ─────────────────────────────────────────────────────────────────
stage("3. /llms.txt (optional)");
try {
  const llms = await fetchPage(`${origin}/llms.txt`);
  if (llms.status === 200 && llms.body.trim().length > 50 && !/<html/i.test(llms.body)) r.pass(`Found ${origin}/llms.txt.`);
  else r.info("No /llms.txt. It is an optional, proposed standard (llmstxt.org); Google says it does not need one.");
} catch {
  r.info("Could not check /llms.txt. It is optional.");
}

// 4. Answer paragraphs ────────────────────────────────────────────────────────
stage("4. Short answer paragraphs");
const answers = elements(html, "p").map((p) => p.text).filter((t) => t.length >= 120 && t.length <= 350);
if (answers.length >= 2) r.pass(`${answers.length} short paragraphs (about 20–60 words) that could be quoted as a direct answer.`);
else r.warn("Few short, quotable paragraphs.", "Under each main heading, open with a plain two- or three-sentence answer before the detail.", 5);

r.finish("GEO CHECKLIST SCORE", flags);
console.log(c.dim("No markup guarantees an AI citation. Google says its AI features use the same signals as regular Search.\n"));
