# Panarch SEO Wizards

Seven small command-line checks that go with Panarch Digital's free **Zero to Revenue SEO** course. Each one fetches a live page and prints a plain-English checklist with a fix list.

| Wizard | Course episode | What it checks |
|---|---|---|
| `seo-wizard` | [1. How Google Works](https://panarchdigital.com/blog/zero-to-revenue-seo-how-google-works) | HTTPS and redirects, robots.txt (including blocked JS/CSS), XML sitemap, `noindex`, title, description, canonical, viewport |
| `onpage-wizard` | [2. The Anatomy of a Perfect Web Page](https://panarchdigital.com/blog/zero-to-revenue-seo-on-page-perfect-page) | Title and meta description length, H1 and heading order, image alt text, generic "click here" anchors, Open Graph tags, canonical, JSON-LD |
| `programmatic-wizard` | [3. Programmatic Scaling](https://panarchdigital.com/blog/zero-to-revenue-seo-programmatic-scaling) | Clean URLs, self-referencing canonicals, schema, breadcrumbs, and how much text sibling pages share |
| `cwv-wizard` | [4. Speed & Core Web Vitals](https://panarchdigital.com/blog/zero-to-revenue-seo-speed-core-web-vitals) | Real-user LCP, INP and CLS from the Chrome UX Report (via the free PageSpeed Insights API), plus HTML speed hazards |
| `geo-wizard` | [5. GEO & Entity Schema](https://panarchdigital.com/blog/zero-to-revenue-seo-geo-ai-overviews-schema) | One connected JSON-LD `@graph` with `@id` links, Organization and `sameAs`, AI search crawler access in robots.txt, the optional `/llms.txt`, short answer paragraphs |
| `cluster-wizard` | [6. Topic Clusters & Internal Linking](https://panarchdigital.com/blog/zero-to-revenue-seo-topical-clusters-internal-linking) | Internal links on the page, generic "read more" anchors, breadcrumbs (on the page or as BreadcrumbList schema) |
| `pr-wizard` | [7. Authority & Digital PR](https://panarchdigital.com/blog/zero-to-revenue-seo-authority-digital-pr-backlinks) | `sameAs` profile links, a link to a research or data page, a press contact, and outbound link attributes (it cannot see your backlinks) |

No dependencies. Needs [Node.js](https://nodejs.org) 18.17 or newer.

## Run without installing

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards seo-wizard https://yourdomain.com
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards onpage-wizard https://yourdomain.com/products/your-product
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards programmatic-wizard https://yourdomain.com/locations/mumbai https://yourdomain.com/locations/delhi
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards cwv-wizard https://yourdomain.com
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards geo-wizard https://yourdomain.com
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards cluster-wizard https://yourdomain.com/blog/your-pillar
```

```bash
npx --package=github:Arpan-Tyagi/panarch-seo-wizards pr-wizard https://yourdomain.com
```

## Or clone and run

```bash
git clone https://github.com/Arpan-Tyagi/panarch-seo-wizards.git
cd panarch-seo-wizards
node bin/seo-wizard.mjs https://yourdomain.com
```

## Options

- `--fail-under N`: exit with code 1 when the score is below N, for use in CI before a deploy.
- `--no-psi` (`cwv-wizard` only): skip the PageSpeed Insights call. Set `PSI_API_KEY` for higher rate limits.
- `NO_COLOR=1`: plain output.

If the page cannot be reached, returns an error status (such as 404) or is not an HTML page, the wizard stops with a message and exit code 1 instead of scoring it.

## Repository layout

```
bin/       One executable per wizard (seo, onpage, programmatic, cwv, geo, cluster, pr)
lib/       core.mjs: the shared fetching, HTML parsing, scoring and report code
test/      wizards.test.mjs: runs every wizard against a local test server
```

Each wizard in `bin/` is a short script: it loads the page, runs its checks and prints a report through `lib/core.mjs`. To add a wizard, create `bin/<name>-wizard.mjs`, register it under `bin` in `package.json`, add a row to the table above and a test.

## Development

```bash
npm test    # node --test, no dependencies to install
```

The tests start a local server with good and bad example pages, so they need no network access.

## What the score means

The score is this tool's own checklist, out of 100. It is **not** a Google ranking signal, and a perfect score does not guarantee rankings. Google's own tools have the final word: [Search Console](https://search.google.com/search-console), [PageSpeed Insights](https://pagespeed.web.dev) and the [Rich Results Test](https://search.google.com/test/rich-results).

The wizards read the HTML your server sends. Pages that build their content in the browser with JavaScript will look emptier to these checks, and that is also roughly what a crawler sees before rendering.

## Want a human to look?

Book a free 30-minute call at [panarchdigital.com/book](https://panarchdigital.com/book).

## Licence

[MIT](LICENSE) © 2026 Arpan Tyagi (Panarch Digital)
