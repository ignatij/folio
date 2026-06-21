/**
 * Fetches home page section builder data from the backend.
 * Returns a per-language map: home.byLang[langCode] = HomeBlock[]
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureTrailingSlash(url) {
  if (!url) return "";
  return url.endsWith("/") ? url : `${url}/`;
}

function performancePath(kind, item) {
  const existing = ensureTrailingSlash(item.url || item.detailUrl || "");
  if (existing) return existing;

  const slug = [item.title, item.location, item.date]
    .map(slugify)
    .filter(Boolean)
    .join("-");

  if (!slug) return "";
  return `/en/performances/${kind}/${slug}/`;
}

function attachDerivedHomeData(blocks) {
  const schedule = blocks.find(
    (block) =>
      block.type === "schedule" &&
      block.config &&
      Array.isArray(block.config.items) &&
      block.config.items.length > 0,
  );
  const firstPerformance = schedule?.config.items[0];

  return blocks.map((block) => {
    if (block.type === "past-performances") {
      const items = Array.isArray(block.config?.items)
        ? block.config.items.map((item) => ({
            ...item,
            url: performancePath("past", item),
          }))
        : [];

      return {
        ...block,
        config: {
          ...block.config,
          items,
        },
      };
    }

    if (block.type !== "hero" || !firstPerformance) return block;

    return {
      ...block,
      config: {
        ...block.config,
        nextPerformance: {
          eyebrow: block.config?.nextPerformanceEyebrow || "Next Performance",
          date: firstPerformance.date,
          title: firstPerformance.title,
          location: firstPerformance.location,
          url: firstPerformance.detailUrl || "#schedule",
        },
      },
    };
  });
}

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch language config for home data");
  }

  const byLang = {};

  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/home?lang=${lang.code}`,
      );
      if (res.ok) {
        const blocks = await res.json();
        byLang[lang.code] = Array.isArray(blocks)
          ? attachDerivedHomeData(
              blocks
                .filter((b) => b.visible !== false)
                .sort((a, b) => a.order - b.order),
            )
          : [];
      } else {
        byLang[lang.code] = [];
      }
    } catch {
      console.warn(
        `[folio] Could not fetch home sections for lang ${lang.code}`,
      );
      byLang[lang.code] = [];
    }
  }

  return { byLang };
}
