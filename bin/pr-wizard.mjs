#!/usr/bin/env node
// Episode 7 (Authority & Digital PR): is this site ready for a journalist to cite it?
import {
  banner, stage, createReport, parseArgs, loadPage, tags, jsonLdBlocks, jsonLdNodes, sameSite, c,
} from "../lib/core.mjs";

const USAGE = `Usage: pr-wizard <url> [--fail-under N]

Checks the digital PR basics from Episode 7 of the Zero to Revenue SEO course on one page
(usually your homepage): sameAs profile links in your schema, a link to a research or data
page, and a way for journalists to contact you. It cannot see your backlinks.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards pr-wizard https://yourdomain.com`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("DIGITAL PR & AUTHORITY WIZARD (EPISODE 7)", target);
const page = await loadPage(target);
const html = page.body;
const anchors = tags(html, "a").filter((a) => a.href);

// 1. sameAs ───────────────────────────────────────────────────────────────────
stage("1. Profile links in your schema (sameAs)");
const sameAs = [...new Set(jsonLdNodes(jsonLdBlocks(html)).flatMap((n) => [].concat(n.sameAs || [])).filter((s) => typeof s === "string"))];
if (sameAs.length >= 3) {
  r.pass(`${sameAs.length} sameAs profile link(s):`);
  sameAs.slice(0, 5).forEach((s) => r.info(`→ ${s}`));
} else if (sameAs.length) {
  r.warn(`Only ${sameAs.length} sameAs profile link(s).`, "Add the other official profiles you own to the sameAs list in your Organization schema.", 10);
} else {
  r.warn("No sameAs links in this page's schema.", "Add an Organization node whose sameAs lists the official profiles you own, so your brand is easy to confirm.", 20);
}

// 2. Research page ────────────────────────────────────────────────────────────
stage("2. A research or data page to cite");
// A path segment has to name it: "/research/heel-wear" counts, "/_next/data" and "metadata" do not.
const RESEARCH = /^(research|data|benchmarks?|stud(?:y|ies)|reports?|insights)(?:-|$)/i;
const research = new Set();
for (const a of anchors) {
  if (!sameSite(a.href, page.url)) continue;
  const path = new URL(a.href, page.url).pathname;
  if (!path.startsWith("/_next/") && path.split("/").some((seg) => RESEARCH.test(seg))) research.add(path);
}
if (research.size) {
  r.pass(`Links to ${research.size} research, data or report page(s).`);
  [...research].slice(0, 3).forEach((p) => r.info(`→ ${p}`));
} else {
  r.warn(
    "No link to a /research, /data or /report page.",
    "Publish your finding on its own page (for example /research/your-study) with the method, data table and chart, and link it from the site.",
    15,
  );
}

// 3. Press contact ────────────────────────────────────────────────────────────
stage("3. A way for journalists to reach you");
const contactPage = anchors.some((a) => sameSite(a.href, page.url) && /(press|media|newsroom|contact|about)/i.test(new URL(a.href, page.url).pathname));
const direct = anchors.some((a) => /^(mailto:|tel:)/i.test(a.href));
if (contactPage && direct) r.pass("Has a contact or press page link and an email or phone link.");
else if (contactPage || direct)
  r.warn(
    contactPage ? "Contact page link found, but no email or phone link on this page." : "Email or phone link found, but no contact or press page link.",
    "Make a press contact easy to find: a named person and an email address, linked from the footer.",
    10,
  );
else r.fail("No contact page, email or phone link on this page.", "Add a contact or press page with an email address, so journalists can check facts with you.", 20);

// 4. Link attributes ──────────────────────────────────────────────────────────
stage("4. Outbound links and backlinks");
const external = anchors.filter((a) => /^https?:/i.test(a.href) && !sameSite(a.href, page.url));
const qualified = external.filter((a) => /\b(sponsored|ugc|nofollow)\b/i.test(a.rel || ""));
r.info(`${external.length} outbound link(s); ${qualified.length} carry rel="sponsored", "ugc" or "nofollow". Mark any paid link "sponsored".`);
r.info("This wizard cannot see your backlinks. Check Search Console → Links → Top linking sites.");

r.finish("DIGITAL PR CHECKLIST SCORE", flags);
console.log(c.dim("Coverage depends on having a finding journalists want to report; no checklist can promise links.\n"));
