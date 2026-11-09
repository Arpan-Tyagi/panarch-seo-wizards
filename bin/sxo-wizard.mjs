#!/usr/bin/env node
// Episode 8 (Search Experience Optimization): Does this page turn search visitors into revenue?
import {
  banner, stage, createReport, parseArgs, loadPage, elements, tags, metaContent, c,
} from "../lib/core.mjs";

const USAGE = `Usage: sxo-wizard <url> [--fail-under N]

Checks one page for mobile conversion and checkout friction from Episode 8 of the Zero to Revenue SEO course:
sticky purchase targets, viewport ergonomics, form field count, and behavioral telemetry.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards sxo-wizard https://yourdomain.com/products/your-product`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("SEARCH EXPERIENCE OPTIMIZATION (SXO) WIZARD (EPISODE 8)", target);

const page = await loadPage(target);
const html = page.body;

// 1. Mobile Viewport & Ergonomics ─────────────────────────────────────────────
stage("1. Mobile Viewport & Ergonomics");
const viewport = metaContent(html, "viewport");
if (viewport && viewport.includes("width=device-width")) {
  r.pass(`Mobile viewport configured: "${viewport}".`);
} else {
  r.fail("Missing or invalid mobile viewport meta tag.", "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to your head tag.", 25);
}

// 2. Mobile Purchase CTAs & Sticky Thumb-Zone ────────────────────────────────
stage("2. Sticky Mobile CTAs & Touch Targets");
const buttons = elements(html, "button");
const buyLinks = elements(html, "a").filter((a) => {
  const t = (a.text || "").toLowerCase();
  const h = (a.attrs.href || "").toLowerCase();
  return t.includes("buy") || t.includes("cart") || t.includes("checkout") || t.includes("shop") || t.includes("book") || t.includes("order") || h.includes("cart") || h.includes("checkout");
});
const totalCtas = buttons.length + buyLinks.length;
r.info(`Found ${totalCtas} conversion button(s) or purchase link(s).`);

const hasSticky = /sticky|fixed|bottom-0|fixed-bottom/i.test(html);
if (hasSticky) {
  r.pass("Detected bottom-anchored sticky or fixed CTA container in markup.");
} else {
  r.warn(
    "No sticky mobile thumb-zone CTA container detected.",
    "Anchor your primary Add to Cart / Checkout button to the viewport bottom (Natural Thumb Zone) on mobile devices.",
    15,
  );
}

// 3. Checkout & Form Friction ─────────────────────────────────────────────────
stage("3. Checkout & Form Friction");
const formInputs = tags(html, "input").filter((input) => {
  const type = (input.type || "text").toLowerCase();
  return !["hidden", "submit", "button", "image"].includes(type);
});
r.info(`Detected ${formInputs.length} visible form input field(s).`);
if (formInputs.length === 0) {
  r.info("No inline input fields detected on this page (typical for product detail pages).");
} else if (formInputs.length <= 4) {
  r.pass(`Lean form: only ${formInputs.length} fields (minimizes checkout drop-off).`);
} else if (formInputs.length <= 8) {
  r.warn(
    `${formInputs.length} form fields detected.`,
    "Slashing form fields down to essential lines (name, contact, address) reduces drop-off.",
    10,
  );
} else {
  r.fail(
    `Heavy form friction: ${formInputs.length} input fields detected.`,
    "Slashing surplus fields (e.g. Address Line 2, Company Name) addresses high cart abandonment rates.",
    20,
  );
}

// 4. Conversion Telemetry & Observability ─────────────────────────────────────
stage("4. Conversion Telemetry & Heatmap Tags");
const hasClarity = /clarity\.ms|msClarity/i.test(html);
const hasAnalytics = /googletagmanager\.com|google-analytics\.com|posthog/i.test(html);

if (hasAnalytics) {
  r.pass("Analytics telemetry detected (GA4 / GTM / PostHog).");
} else {
  r.warn("No conversion analytics script detected.", "Deploy GA4 or PostHog to track the purchase journey.", 10);
}

if (hasClarity) {
  r.pass("Microsoft Clarity heatmap script detected (monitors mobile rage clicks).");
} else {
  r.info("Microsoft Clarity not detected. Clarity is free forever and tracks one-handed mobile thumb rage clicks.");
}

r.finish("SXO & CHECKOUT SCORE", { failUnder: flags.failUnder });
