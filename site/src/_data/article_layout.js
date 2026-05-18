/**
 * Fetches article layout builder block data from the backend, per language.
 * Returns { byLang: { [langCode]: HomeBlock[] } } — a single global layout applied to all articles,
 * with block translations resolved for each language.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn(
      "[folio] Could not fetch language config for article layout data",
    );
  }

  const byLang = {};

  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/article-layout?lang=${lang.code}`,
      );
      if (res.ok) {
        const raw = await res.json();
        byLang[lang.code] = Array.isArray(raw)
          ? raw
              .filter((b) => b.visible !== false)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
      } else {
        byLang[lang.code] = [];
      }
    } catch {
      console.warn(
        `[folio] Could not fetch article layout for lang ${lang.code}`,
      );
      byLang[lang.code] = [];
    }
  }

  return { byLang };
}
