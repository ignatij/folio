/**
 * Fetches article layout builder block data from the backend.
 * Returns { sections: HomeBlock[] } — a single global layout applied to all articles.
 * Unlike home/footer, article_sections are language-agnostic structural config.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/article-layout`);
    if (!res.ok) return { sections: [] };
    const raw = await res.json();
    const sections = Array.isArray(raw)
      ? raw
          .filter((b) => b.visible !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];
    return { sections };
  } catch {
    console.warn("[folio] Could not fetch article layout config");
    return { sections: [] };
  }
}
