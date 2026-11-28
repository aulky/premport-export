// Semua yang dibaca mesin pencari, crawler AI, dan pratinjau tautan (WhatsApp dkk).
// Dibuat di server karena mereka umumnya tidak menjalankan JavaScript, dan
// og:image wajib berupa URL lengkap dengan domain.
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

const NAME = "Cookie Scraping Tools";
const TITLE = `${NAME} – Cookie Scraper and Cookie-Editor JSON Exporter`;
const DESCRIPTION =
  "Cookie Scraping Tools keeps accounts signed in, scrapes their session cookies automatically, and exports them as Cookie-Editor JSON you can import into your browser in one click.";

const ABOUT_TITLE = `About ${NAME}: Cookie Scraper Features and FAQ`;
const ABOUT_DESCRIPTION =
  "How Cookie Scraping Tools scrapes session cookies: automatic sign-in, fresh cookies before they expire, Cookie-Editor JSON export, encrypted storage, and access history.";

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
const IMAGE_ALT = `${NAME} logo`;

const FEATURES = [
  "Scrapes session cookies automatically after signing in to each account",
  "Signs in again before a session expires, so cookies stay fresh",
  "Export as Cookie-Editor JSON, ready to import into a browser",
  "Per-app cookie fetching from the app catalog",
  "Cookies are encrypted with AES-256-GCM before they are stored",
  "Admin and user accounts, with a history of sign-ins and cookie downloads",
];

const FAQ: [question: string, answer: string][] = [
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
  ["Can anyone sign up?", "No. There is no public sign-up; an administrator creates user accounts."],
];

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const jsonLd = (data: object) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

/** Alamat publik situs: PUBLIC_URL kalau diisi, kalau tidak dari header request. */
export function siteUrl(req: FastifyRequest): string {
  if (config.publicUrl) return config.publicUrl;
  const host = req.host;
  const safe = /^([a-z0-9.-]+|\[[0-9a-f:.]+\])(:\d{1,5})?$/i.test(host);
  return safe ? `${req.protocol}://${host}` : "";
}

/** Isi <head>. `path` null = halaman privat: tetap punya pratinjau, tapi tidak diindeks. */
function headTags(base: string, path: string | null): string {
  const url = `${base}${path ?? "/"}`;
  const title = path === "/about" ? ABOUT_TITLE : TITLE;
  const description = path === "/about" ? ABOUT_DESCRIPTION : DESCRIPTION;
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
        `<div id="root"></div>\n    <noscript><h1>${esc(NAME)}</h1><p>${esc(DESCRIPTION)}</p><p><a href="/about">About ${esc(NAME)}</a></p></noscript>`,
    );
}

/** Halaman publik /about: HTML biasa, terbaca tanpa JavaScript. */
export function renderAbout(base: string): string {
  const faqLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#008c8d" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    ${headTags(base, "/about")}
    ${faqLd}
    <style>
      body { margin: 0; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #f4f6f9; }
      main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
      h1 { margin: 1rem 0 0.5rem; font-size: 2rem; line-height: 1.2; color: #0b7677; }
      h2 { margin: 2.25rem 0 0.5rem; font-size: 1.25rem; }
      h3 { margin: 1.25rem 0 0.25rem; font-size: 1rem; }
      p { margin: 0.5rem 0; }
      a.button { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.4rem; border-radius: 0.6rem; background: #0b7677; color: #fff; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <img src="/favicon.svg" alt="${esc(IMAGE_ALT)}" width="72" height="72" />
      <h1>${esc(NAME)}</h1>
      <p>${esc(DESCRIPTION)}</p>
      <a class="button" href="/">Sign in</a>
      <h2>How it works</h2>
      <ol>
        <li>Sign in to the dashboard.</li>
        <li>Pick an account or app and fetch its cookies.</li>
        <li>Import the JSON file with Cookie-Editor on the target website, then reload the page.</li>
      </ol>
      <h2>Features</h2>
      <ul>
        ${FEATURES.map((f) => `<li>${esc(f)}</li>`).join("\n        ")}
      </ul>
      <h2>Questions and answers</h2>
      ${FAQ.map(([q, a]) => `<h3>${esc(q)}</h3>\n      <p>${esc(a)}</p>`).join("\n      ")}
      <h2>Responsible use</h2>
      <p>Use it only with accounts you are allowed to use, and follow the terms of service of the provider.</p>
    </main>
  </body>
</html>
`;
}

export const renderRobots = (base: string) => `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;

export const renderSitemap = (base: string) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(base)}/</loc></url>
  <url><loc>${esc(base)}/about</loc></url>
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

- [About](${base}/about)
- [Sign in](${base}/)
`;
