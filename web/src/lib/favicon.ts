/**
 * Ikon situs lewat layanan favicon publik Google (tanpa API key, berlaku untuk
 * domain apapun) -- dipakai sebagai ikon app di dashboard. Akurat untuk situs
 * tujuan (Netflix, ChatGPT, dst.) karena memang favicon asli situs tsb.
 */
export function faviconUrl(siteUrl: string | null, size = 64): string | null {
  if (!siteUrl) return null;
  try {
    const { hostname } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?sz=${size}&domain=${hostname}`;
  } catch {
    return null;
  }
}
