#!/usr/bin/env node
// Episode 4 (Speed & Core Web Vitals): real-user field data plus page-level speed hazards.
import {
  banner, stage, createReport, parseArgs, loadPage, tags, head, c,
} from "../lib/core.mjs";

const USAGE = `Usage: cwv-wizard <url> [--no-psi] [--fail-under N]

Checks speed from Episode 4 of the Zero to Revenue SEO course.
1. Real-user Core Web Vitals (LCP, INP, CLS at the 75th percentile) from Google's
   Chrome UX Report, fetched through the free PageSpeed Insights API.
   Set PSI_API_KEY for higher rate limits; --no-psi skips this step.
2. Speed hazards in the page's HTML: size, third-party scripts, a lazy-loaded
   hero image, images without dimensions and font loading.

  npx --package=github:Arpan-Tyagi/panarch-seo-wizards cwv-wizard https://yourdomain.com`;

const { urls, flags } = parseArgs(process.argv.slice(2), USAGE);
const target = urls[0];
const r = createReport();
banner("CORE WEB VITALS WIZARD (EPISODE 4)", target);
// Load the page first, so a wrong URL stops before the slow PageSpeed Insights call.
const page = await loadPage(target);

// 1. Field data ───────────────────────────────────────────────────────────────
stage("1. Real-user Core Web Vitals (Chrome UX Report, mobile, 75th percentile)");
if (flags["no-psi"]) {
  r.info("Skipped (--no-psi).");
} else {
  await fieldData();
}

// 2. HTML hazards ─────────────────────────────────────────────────────────────
stage("2. Speed hazards in the HTML");
const html = page.body;
const kb = Buffer.byteLength(html, "utf8") / 1024;

r.info(`First response after ${page.headerMs}ms from this machine (a rough guide, not real-user TTFB).`);
if (page.headerMs > 800) r.warn("Slow first response (over 800ms).", "Cache pages at the edge (CDN) and cut slow server work before the HTML is sent.");

if (kb > 500) r.fail(`HTML is ${kb.toFixed(0)} KB.`, "Trim inline JSON, SVG and repeated markup; large HTML delays the first paint on phones.", 10);
else if (kb > 200) r.warn(`HTML is ${kb.toFixed(0)} KB.`, "Look for large inline data or SVG in the HTML.", 3);
else r.pass(`HTML is ${kb.toFixed(0)} KB.`);

const host = new URL(target).hostname.replace(/^www\./, "");
const scripts = tags(html, "script").filter((a) => a.src);
const thirdParty = [...new Set(
  scripts
    .map((a) => { try { return new URL(a.src, target).hostname; } catch { return ""; } })
    .filter((h) => h && !h.endsWith(host)),
)];
r.info(`${scripts.length} external script file(s); ${thirdParty.length} third-party host(s)${thirdParty.length ? `: ${thirdParty.join(", ")}` : ""}.`);
if (thirdParty.length > 8)
  r.fail("More than 8 third-party script hosts.", "Remove apps and trackers you no longer use (on Shopify: uninstall them and switch off their App embeds).", 15);
else if (thirdParty.length > 4)
  r.warn("5–8 third-party script hosts.", "Review which marketing scripts still earn their place; delay the rest until after the page is interactive.", 5);
else r.pass("Few third-party script hosts.");

const TRACKERS = [
  ["Google Tag Manager", /googletagmanager\.com/i],
  ["Meta Pixel", /connect\.facebook\.net/i],
  ["Hotjar", /static\.hotjar\.com/i],
  ["Klaviyo", /klaviyo\.com/i],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
  ["Microsoft Clarity", /clarity\.ms/i],
];
const found = TRACKERS.filter(([, re]) => re.test(html)).map(([n]) => n);
if (found.length) r.info(`Trackers detected: ${found.join(", ")}. Each one competes for the phone's main thread.`);

const imgs = tags(html, "img");
const firstImg = imgs[0];
if (firstImg && /lazy/i.test(firstImg.loading || ""))
  r.warn(
    "The first image on the page is lazy-loaded. If it is the hero image, that delays LCP.",
    "Do not lazy-load the hero image. In Next.js 16 give it the `preload` prop; elsewhere add fetchpriority=\"high\".",
    10,
  );
const preload = tags(head(html), "link").some((a) => /preload/i.test(a.rel || "") && (a.as || "") === "image");
if (preload) r.pass("An image is preloaded in <head> (good for a hero image).");
else r.info("No image preload in <head>. Worth adding for a large hero image.");

const noDims = imgs.filter((a) => !(a.width && a.height) && !/fill|aspect/i.test(`${a["data-nimg"] || ""} ${a.style || ""} ${a.class || ""}`));
if (noDims.length)
  r.warn(`${noDims.length} of ${imgs.length} images have no width and height.`, "Give images width and height (or a CSS aspect-ratio) so the page does not jump while they load.");
else if (imgs.length) r.pass("All images reserve their space (width and height or aspect ratio).");

const legacy = imgs.filter((a) => /\.(jpe?g|png)(\?|$)/i.test(a.src || "") && !/\/_next\/image|format=/i.test(a.src || ""));
if (legacy.length > 3) r.warn(`${legacy.length} images served as JPEG or PNG.`, "Convert photos to WebP or AVIF (Squoosh.app is free).", 5);

if (/@font-face/i.test(html) && !/font-display\s*:\s*(swap|optional)/i.test(html))
  r.warn("Web fonts without font-display: swap or optional.", "Add font-display: swap so text shows while the font loads.", 3);

r.finish("SPEED READINESS SCORE", flags);
console.log(c.dim("Core Web Vitals are judged on real users. Re-check field data 28 days after a fix.\n"));

// ── PageSpeed Insights / CrUX ────────────────────────────────────────────────
async function fieldData() {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", target);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  if (process.env.PSI_API_KEY) api.searchParams.set("key", process.env.PSI_API_KEY);
  console.log(c.dim("  Asking PageSpeed Insights (this can take 20–60 seconds)…"));
  let data;
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(120_000) });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  } catch (err) {
    const quota = /quota/i.test(err.message);
    r.info(
      quota
        ? "PageSpeed Insights' shared free quota is used up for today. Get a free API key (Google Cloud console → enable PageSpeed Insights API → create key), set PSI_API_KEY and run again, or use https://pagespeed.web.dev."
        : `PageSpeed Insights unavailable (${err.message}). Run the test at https://pagespeed.web.dev instead.`,
    );
    return;
  }

  const exp = data.loadingExperience?.metrics ? data.loadingExperience : data.originLoadingExperience;
  const scope = exp === data.loadingExperience ? "this URL" : "the whole origin (not enough data for this URL)";
  if (!exp?.metrics) {
    r.info("No real-user data yet: the site needs more Chrome visitors before Google reports field metrics.");
  } else {
    r.info(`Field data for ${scope}, last 28 days:`);
    const metric = (key, label, fmt, good, poor) => {
      const m = exp.metrics[key];
      if (!m) return r.info(`${label}: no data.`);
      const v = m.percentile;
      const shown = fmt(v);
      if (v <= good) r.pass(`${label}: ${shown} (good)`);
      else if (v <= poor) r.warn(`${label}: ${shown} (needs improvement)`, `Bring ${label} into the "good" range.`, 10);
      else r.fail(`${label}: ${shown} (poor)`, `Fix ${label} first; it is in Google's "poor" range.`, 20);
    };
    metric("LARGEST_CONTENTFUL_PAINT_MS", "LCP", (v) => `${(v / 1000).toFixed(2)}s`, 2500, 4000);
    metric("INTERACTION_TO_NEXT_PAINT", "INP", (v) => `${v}ms`, 200, 500);
    metric("CUMULATIVE_LAYOUT_SHIFT_SCORE", "CLS", (v) => (v / 100).toFixed(2), 10, 25);
  }
  const lab = data.lighthouseResult?.categories?.performance?.score;
  if (typeof lab === "number")
    r.info(`Lighthouse lab performance score: ${Math.round(lab * 100)}/100 (a simulated test; Google ranks on field data).`);
}
