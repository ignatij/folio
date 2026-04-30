import type { ThemeSettings } from "../api/types";

const SYSTEM_FONTS = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "helvetica",
  "arial",
  "sans-serif",
  "serif",
  "monospace",
  "inherit",
  "initial",
  "unset",
  "georgia",
  "times new roman",
  "times",
  "courier new",
  "courier",
  "verdana",
  "trebuchet ms",
  "impact",
  "comic sans ms",
]);

function buildGoogleFontsUrl(
  fontNames: (string | null | undefined)[],
): string | null {
  const toLoad = [...new Set(fontNames)]
    .filter((f): f is string => Boolean(f))
    .map((f) => f.trim())
    .filter((f) => f && !SYSTEM_FONTS.has(f.toLowerCase()));
  if (toLoad.length === 0) return null;
  const families = toLoad
    .map(
      (f) =>
        `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`,
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Apply a ThemeSettings object to the current document:
 * - Injects/updates CSS custom properties in #folio-theme <style>
 * - Injects/updates @font-face rules in #folio-fonts-face <style> for uploaded fonts
 * - Injects/updates a Google Fonts <link> for non-system, non-uploaded fonts
 */
export function applyThemeToDocument(theme: ThemeSettings) {
  const fonts = theme.fonts;

  // ── CSS variables ───────────────────────────────────────────────────────────
  let styleEl = document.getElementById(
    "folio-theme",
  ) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "folio-theme";
    document.head.appendChild(styleEl);
  }
  const vars = [
    ...Object.entries(theme.colors).map(([k, v]) => `  --color-${k}: ${v};`),
    `  --font-body: ${fonts?.body ?? "Inter"};`,
    `  --font-heading: ${fonts?.heading ?? fonts?.body ?? "Inter"};`,
    `  --font-fallback: ${fonts?.fallback ?? "system-ui, sans-serif"};`,
    `  --radius-button: ${theme.radius?.button ?? "8px"};`,
    `  --radius-card: ${theme.radius?.card ?? "12px"};`,
    `  --radius-input: ${theme.radius?.input ?? "6px"};`,
  ].join("\n");
  styleEl.textContent = `:root {\n${vars}\n}`;

  // ── @font-face for uploaded font files ─────────────────────────────────────
  const fontFaceRules: string[] = [];
  if (fonts?.body_url) {
    fontFaceRules.push(
      `@font-face { font-family: '${fonts.body}'; src: url('${fonts.body_url}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }`,
    );
  }
  if (fonts?.heading_url && fonts.heading_url !== fonts.body_url) {
    fontFaceRules.push(
      `@font-face { font-family: '${fonts.heading}'; src: url('${fonts.heading_url}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }`,
    );
  }
  let faceEl = document.getElementById(
    "folio-fonts-face",
  ) as HTMLStyleElement | null;
  if (fontFaceRules.length > 0) {
    if (!faceEl) {
      faceEl = document.createElement("style");
      faceEl.id = "folio-fonts-face";
      document.head.appendChild(faceEl);
    }
    faceEl.textContent = fontFaceRules.join("\n");
  } else if (faceEl) {
    faceEl.remove();
  }

  // ── Google Fonts link for non-uploaded fonts ────────────────────────────────
  const fontsNeedingGoogle = [
    fonts?.body_url ? null : fonts?.body,
    fonts?.heading_url ? null : fonts?.heading,
  ];
  const googleFontsUrl = buildGoogleFontsUrl(fontsNeedingGoogle);
  let linkEl = document.getElementById("folio-fonts") as HTMLLinkElement | null;
  if (googleFontsUrl) {
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = "folio-fonts";
      linkEl.rel = "stylesheet";
      document.head.appendChild(linkEl);
    }
    linkEl.href = googleFontsUrl;
  } else if (linkEl) {
    linkEl.remove();
  }
}
