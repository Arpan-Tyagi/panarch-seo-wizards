import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let server;
let base;

const page = ({ title, desc, h1s, body = "", robots = "", canonical = true, extraHead = "" }, url) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${title ? `<title>${title}</title>` : ""}
${desc ? `<meta content="${desc}" name="description">` : ""}
${robots ? `<meta name="robots" content="${robots}">` : ""}
${canonical ? `<link rel="canonical" href="${url}">` : ""}
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="/og.png">
${extraHead}
</head><body>${h1s.map((h) => `<h1>${h}</h1>`).join("")}${body}</body></html>`;

const filler = (seed) =>
  Array.from({ length: 80 }, (_, i) => `Fact ${i} about ${seed} that only applies to ${seed} and nowhere else.`).join(" ");
const shared = Array.from({ length: 80 }, (_, i) => `Our team builds fast storefronts and sentence ${i} is identical.`).join(" ");

before(async () => {
  server = http.createServer((req, res) => {
    const url = `${base}${req.url}`;
    const send = (status, type, body) => {
      res.writeHead(status, { "content-type": type });
      res.end(body);
    };
    switch (req.url) {
      case "/robots.txt":
        return send(200, "text/plain", `User-agent: *\nDisallow: /_next/\n\nUser-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /\n\nSitemap: ${base}/sitemap.xml\n`);
      case "/sitemap.xml":
        return send(200, "application/xml", `<urlset><url><loc>${base}/good</loc></url></urlset>`);
      case "/good":
        return send(200, "text/html", page({
          title: "Handcrafted Leather Boots - Goodyear Welted | Example",
          desc: "Tired of boots that crack in six months? Full-grain leather boots with resolable Goodyear welted soles, made to order. See sizes and prices today.",
          h1s: ["Handcrafted leather boots"],
          body: `<h2>Sizes</h2><img src="/a.webp" alt="Brown boots" width="800" height="600"><a href="/sizes">compare boot sizes</a><a href="/care">leather care guide</a><a href="/returns">returns policy</a>
                 <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Boots"}</script>`,
        }, url));
      case "/bad":
        return send(200, "text/html", page({
          h1s: ["One", "Two"],
          robots: "noindex",
          canonical: false,
          body: `<h2>x</h2><h4>skip</h4><img src="/a.jpg" loading="lazy"><a href="/x">click here</a>`,
        }, url));
      case "/entity": {
        const graph = {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${base}/#org`, name: "Example Boots", sameAs: ["https://www.linkedin.com/company/x", "https://www.instagram.com/x", "https://github.com/x"] },
            { "@type": "Product", "@id": `${base}/entity#product`, name: "Boot", brand: { "@id": `${base}/#org` } },
          ],
        };
        const answer = "Goodyear welted boots can be resoled several times because the sole is stitched to a leather welt rather than glued, so a cobbler can replace it without touching the upper.";
        const nav = Array.from({ length: 12 }, (_, i) => `<a href="/guide-${i}">boot care guide ${i}</a>`).join("");
        return send(200, "text/html", page({
          title: "Example", desc: "d", h1s: ["Boots"],
          body: `<nav aria-label="breadcrumb"><a href="/">Home</a></nav>${nav}<p>${answer}</p><p>${answer}</p>
                 <a href="/research/heel-wear">heel wear study</a><a href="/contact">contact</a><a href="mailto:press@example.com">press@example.com</a>
                 <a href="https://partner.example/" rel="sponsored">partner</a>
                 <script type="application/ld+json">${JSON.stringify(graph)}</script>`,
        }, url));
      }
      case "/locations/a":
      case "/locations/b":
        return send(200, "text/html", page({ title: "City page", desc: "d", h1s: ["City"], body: `<p>${shared}</p>` }, url));
      case "/locations/c":
        return send(200, "text/html", page({ title: "City page", desc: "d", h1s: ["City"], body: `<p>${filler("Chennai")}</p>` }, url));
      default:
        return send(404, "text/plain", "not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function run(bin, args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(root, "bin", bin), ...args], { env: { ...process.env, NO_COLOR: "1" } }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code : 0, out: stdout + stderr }),
    );
  });
}

const score = (out) => Number(out.match(/SCORE: (\d+) \/ 100/)[1]);
const ALL = ["seo-wizard.mjs", "onpage-wizard.mjs", "programmatic-wizard.mjs", "cwv-wizard.mjs", "geo-wizard.mjs", "cluster-wizard.mjs", "pr-wizard.mjs"];

test("every wizard prints usage and exits 2 without a URL", async () => {
  for (const bin of ALL) {
    const { code, out } = await run(bin, []);
    assert.equal(code, 2, bin);
    assert.match(out, /Usage:/);
  }
});

test("every wizard stops without a score on an error page, a non-HTML file or an unreachable host", async () => {
  const cases = [
    [`${base}/missing`, /returned HTTP 404/],
    [`${base}/robots.txt`, /not an HTML page/],
    ["http://127.0.0.1:1/", /Could not reach/],
  ];
  for (const bin of ALL) {
    for (const [url, message] of cases) {
      const { code, out } = await run(bin, [url, "--no-psi"]);
      assert.equal(code, 1, `${bin} ${url}`);
      assert.match(out, message, `${bin} ${url}`);
      assert.doesNotMatch(out, /SCORE:/, `${bin} ${url}`);
      assert.doesNotMatch(out, /Assertion failed/, `${bin} ${url}`);
    }
  }
});

test("seo-wizard flags blocked JS folders and noindex", async () => {
  const good = await run("seo-wizard.mjs", [`${base}/good`]);
  assert.match(good.out, /blocks script or style files: \/_next\//);
  assert.match(good.out, /No 'noindex'/);
  assert.match(good.out, /Sitemap found: 1 URLs/);
  const bad = await run("seo-wizard.mjs", [`${base}/bad`]);
  assert.match(bad.out, /carries 'noindex'/);
  assert.ok(score(bad.out) < score(good.out));
});

test("onpage-wizard passes a clean page and flags a messy one", async () => {
  const good = await run("onpage-wizard.mjs", [`${base}/good`]);
  assert.match(good.out, /One H1/);
  assert.match(good.out, /Every image has an alt attribute/);
  assert.match(good.out, /Product/);
  const bad = await run("onpage-wizard.mjs", [`${base}/bad`]);
  assert.match(bad.out, /2 H1 headings/);
  assert.match(bad.out, /no alt attribute/);
  assert.match(bad.out, /"click here"/);
  assert.match(bad.out, /Heading levels skip/);
  assert.ok(score(bad.out) < score(good.out));
});

test("programmatic-wizard measures shared text between sibling pages", async () => {
  const copies = await run("programmatic-wizard.mjs", [`${base}/locations/a`, `${base}/locations/b`]);
  assert.match(copies.out, /100% of 5-word phrases shared/);
  const distinct = await run("programmatic-wizard.mjs", [`${base}/locations/a`, `${base}/locations/c`]);
  assert.match(distinct.out, /\b\d% of 5-word phrases shared/);
  assert.match(copies.out, /points its canonical at itself/);
});

test("cwv-wizard flags a lazy-loaded first image and honours --fail-under", async () => {
  const bad = await run("cwv-wizard.mjs", [`${base}/bad`, "--no-psi", "--fail-under", "100"]);
  assert.match(bad.out, /first image on the page is lazy-loaded/);
  assert.equal(bad.code, 1);
  const good = await run("cwv-wizard.mjs", [`${base}/good`, "--no-psi"]);
  assert.equal(good.code, 0);
  assert.match(good.out, /reserve their space/);
});

test("geo-wizard reads the @graph, sameAs and AI crawler rules", async () => {
  const good = await run("geo-wizard.mjs", [`${base}/entity`]);
  assert.match(good.out, /Uses one connected @graph/);
  assert.match(good.out, /Nodes are linked by @id/);
  assert.match(good.out, /"Example Boots" lists 3 sameAs/);
  assert.match(good.out, /PerplexityBot is blocked from the whole site/);
  assert.match(good.out, /Training crawlers blocked: GPTBot/);
  assert.match(good.out, /2 short paragraphs/);
  const bad = await run("geo-wizard.mjs", [`${base}/bad`]);
  assert.match(bad.out, /No JSON-LD on this page/);
  assert.ok(score(bad.out) < score(good.out));
});

test("cluster-wizard counts internal links, generic anchors and breadcrumbs", async () => {
  const good = await run("cluster-wizard.mjs", [`${base}/entity`]);
  assert.match(good.out, /Links to 1[0-9] different pages/);
  assert.match(good.out, /Breadcrumbs found \(on the page\)/);
  const bad = await run("cluster-wizard.mjs", [`${base}/bad`]);
  assert.match(bad.out, /say only "click here"/);
  assert.match(bad.out, /No breadcrumbs found/);
  assert.ok(score(bad.out) < score(good.out));
});

test("pr-wizard finds sameAs links, a research page and a press contact", async () => {
  const good = await run("pr-wizard.mjs", [`${base}/entity`]);
  assert.match(good.out, /3 sameAs profile link/);
  assert.match(good.out, /\/research\/heel-wear/);
  assert.match(good.out, /contact or press page link and an email/);
  assert.match(good.out, /1 carry rel="sponsored"/);
  assert.match(good.out, /cannot see your backlinks/);
  const bad = await run("pr-wizard.mjs", [`${base}/bad`]);
  assert.match(bad.out, /No sameAs links/);
  assert.ok(score(bad.out) < score(good.out));
});
