// Semua yang dibaca mesin pencari, crawler AI, dan pratinjau tautan (WhatsApp dkk).
// Dibuat di server karena mereka umumnya tidak menjalankan JavaScript, dan
// og:image wajib berupa URL lengkap dengan domain.
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

export const NAME = "Cookie Scraping Tools";
const TITLE = `${NAME} – Cookie Scraper and Cookie-Editor JSON Exporter`;
export const DESCRIPTION =
  "Cookie Scraping Tools keeps accounts signed in, scrapes their session cookies automatically, and exports them as Cookie-Editor JSON you can import into your browser in one click.";

const KEYWORDS = [
  "cookie scraping",
  "cookie scraper",
  "session cookies",
  "export cookies",
  "Cookie-Editor JSON",
  "import cookies",
];

// Naikkan angka ?v= kalau gambarnya diganti, supaya cache pratinjau ikut diperbarui.
const IMAGE = "/og-image.png?v=1";
export const IMAGE_ALT = `${NAME} logo`;

export const FEATURES = [
  "Scrapes session cookies automatically after signing in to each account",
  "Signs in again before a session expires, so cookies stay fresh",
  "Export as Cookie-Editor JSON, ready to import into a browser",
  "Per-app cookie fetching from the app catalog",
  "Cookies are encrypted with AES-256-GCM before they are stored",
  "Admin and user accounts, with a history of sign-ins and cookie downloads",
];

export const FAQ: [question: string, answer: string][] = [
  [
    `What is ${NAME}?`,
    "A cookie scraping tool: it keeps account sessions signed in, scrapes their cookies, and lets you download them as a JSON file.",
  ],
  [
    "Which format are the scraped cookies in?",
    "The JSON format of the Cookie-Editor browser extension, so the file can be imported directly into your browser.",
  ],
  [
    "How do I use the cookies?",
    "Install Cookie-Editor, open the target website, then import the downloaded JSON file and reload the page.",
  ],
  [
    "Do the cookies expire?",
    "Sessions are checked regularly and signed in again before they expire, so the latest download is always fresh.",
  ],
  [
    "How are the cookies protected?",
    "They are encrypted with AES-256-GCM before they are stored, and every download requires a signed-in account.",
  ],
  [
    "Which apps are supported?",
    "The app catalog lists the apps the provider offers. Each app shows whether its cookies, account credentials, or an account list can be fetched.",
  ],
  [
    "What happens if I sign in on another device?",
    "The previous session ends right away, so one account cannot be used in two places at once.",
  ],
  ["Can anyone sign up?", "No. There is no public sign-up; an administrator creates user accounts."],
];

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const jsonLd = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

/** Alamat publik situs: PUBLIC_URL kalau diisi, kalau tidak dari header request. */
export function siteUrl(req: FastifyRequest): string {
  if (config.publicUrl) return config.publicUrl;
  const host = req.host;
  const safe = /^([a-z0-9.-]+|\[[0-9a-f:.]+\])(:\d{1,5})?$/i.test(host);
  return safe ? `${req.protocol}://${host}` : "";
}

/** Isi <head>. `path` null = halaman privat: tetap punya pratinjau, tapi tidak diindeks. */
export function headTags(base: string, path: string | null): string {
  const url = `${base}${path ?? "/"}`;
  const title = TITLE;
  const description = DESCRIPTION;
  const image = `${base}${IMAGE}`;
  const meta = (attr: "name" | "property", key: string, value: string) =>
    `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return [
    `<title>${esc(title)}</title>`,
    meta("name", "description", description),
    meta("name", "keywords", KEYWORDS.join(", ")),
    meta("name", "robots", path === null ? "noindex" : "index, follow, max-image-preview:large"),
    path === null ? "" : `<link rel="canonical" href="${esc(url)}" />`,
    `<link rel="icon" href="/favicon.ico" sizes="48x48" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", NAME),
    meta("property", "og:locale", "en_US"),
    meta("property", "og:title", title),
    meta("property", "og:description", description),
    meta("property", "og:url", url),
    meta("property", "og:image", image),
    meta("property", "og:image:type", "image/png"),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta("property", "og:image:alt", IMAGE_ALT),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", title),
    meta("name", "twitter:description", description),
    meta("name", "twitter:image", image),
    jsonLd({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: NAME,
      description: DESCRIPTION,
      applicationCategory: "UtilitiesApplication",
      applicationSubCategory: "Cookie scraper",
      operatingSystem: "Web browser",
      keywords: KEYWORDS.join(", "),
      url: `${base}/`,
      image,
      featureList: FEATURES,
      inLanguage: "en",
    }),
    path === "/" ? jsonLd({ "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: `${base}/` }) : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

/** index.html hasil build Vite + tag SEO. */
export function renderIndex(html: string, base: string, path: string | null): string {
  return html
    .replace(/<title>[^<]*<\/title>/, () => headTags(base, path))
    .replace(
      '<div id="root"></div>',
      () =>
        `<div id="root"></div>\n    <noscript><h1>${esc(NAME)}</h1><p>${esc(DESCRIPTION)}</p><p><a href="/">About ${esc(NAME)}</a></p></noscript>`,
    );
}

export const renderRobots = (base: string) => `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;

export const renderSitemap = (base: string) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(base)}/</loc></url>
</urlset>
`;

/** Ringkasan untuk asisten AI (konvensi llms.txt). */
export const renderLlms = (base: string) => `# ${NAME}

> ${DESCRIPTION}

## Features

${FEATURES.map((f) => `- ${f}`).join("\n")}

## Questions and answers

${FAQ.map(([q, a]) => `### ${q}\n\n${a}`).join("\n\n")}

## Links

- [Home and features](${base}/)
- [Sign in](${base}/login)
`;
