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

function generatedUrl(kind, item) {
  const configured = ensureTrailingSlash(
    kind === "upcoming" ? item.detailUrl : item.url,
  );
  if (configured) return configured;

  const slug = [item.title, item.location, item.date]
    .map(slugify)
    .filter(Boolean)
    .join("-");

  return slug ? `/en/performances/${kind}/${slug}/` : "";
}

function normalizeImageList(images, fallbackImage, fallbackAlt) {
  const normalized = Array.isArray(images)
    ? images
        .map((image) => ({
          src: image.src || "",
          alt: image.alt || fallbackAlt || "",
        }))
        .filter((image) => image.src)
    : [];

  if (normalized.length > 0 || !fallbackImage) return normalized;
  return [{ src: fallbackImage, alt: fallbackAlt || "" }];
}

function schedulePages(items) {
  return items
    .map((item) => {
      const url = generatedUrl("upcoming", item);
      if (!url) return null;

      return {
        kind: "upcoming",
        lang: "en",
        backUrl: "/en/#schedule",
        backLabel: "Back to Schedule",
        eyebrow: "Upcoming Performance",
        url,
        title: item.title || "Upcoming Performance",
        date: item.date || "",
        location: item.location || "",
        intro: item.intro || "",
        facts: [
          item.date ? { label: "Date", value: item.date } : null,
          item.time ? { label: "Time", value: item.time } : null,
          item.venue ? { label: "Venue", value: item.venue } : null,
          item.location ? { label: "Location", value: item.location } : null,
          item.performers ? { label: "Performers", value: item.performers } : null,
          item.duration ? { label: "Duration", value: item.duration } : null,
        ].filter(Boolean),
      };
    })
    .filter(Boolean);
}

function pastPages(items) {
  return items
    .map((item) => {
      const url = generatedUrl("past", item);
      if (!url) return null;

      return {
        kind: "past",
        lang: "en",
        backUrl: "/en/#past-performances",
        backLabel: "Back to Past Performances",
        eyebrow: "Past Performance",
        url,
        title: item.title || "Past Performance",
        date: item.date || "",
        location: item.location || "",
        intro: item.summary || "",
        heroImage: item.heroImage || item.image || "",
        facts: [
          item.date ? { label: "Date", value: item.date } : null,
          item.location ? { label: "Location", value: item.location } : null,
          item.format ? { label: "Format", value: item.format } : null,
          item.performers ? { label: "Performers", value: item.performers } : null,
        ].filter(Boolean),
        program: Array.isArray(item.program)
          ? item.program
              .map((row) => ({
                label: row.label || "",
                value: row.value || "",
              }))
              .filter((row) => row.label || row.value)
          : [],
        images: normalizeImageList(item.images, item.image, item.title),
        videos: Array.isArray(item.videos)
          ? item.videos
              .map((video) => ({
                title: video.title || "",
                youtubeEmbedUrl: video.youtubeEmbedUrl || video.src || "",
              }))
              .filter((video) => video.youtubeEmbedUrl)
          : [],
      };
    })
    .filter(Boolean);
}

export default async function () {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/home?lang=en`);
    if (!res.ok) return [];

    const blocks = await res.json();
    if (!Array.isArray(blocks)) return [];

    const visibleBlocks = blocks.filter((block) => block.visible !== false);
    const schedule = visibleBlocks.find((block) => block.type === "schedule");
    const past = visibleBlocks.find(
      (block) => block.type === "past-performances",
    );

    return [
      ...schedulePages(schedule?.config?.items ?? []),
      ...pastPages(past?.config?.items ?? []),
    ];
  } catch {
    console.warn(
      "[folio] Could not fetch performance page data — no performance detail pages generated.",
    );
    return [];
  }
}
