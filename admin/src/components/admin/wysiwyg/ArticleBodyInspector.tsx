import { ContainerBlockEditor, BLOCK_LABELS } from "../blockShared";
import { AnimationSection } from "./AnimationSection";

interface ArticleBodyInspectorProps {
  blockId: string;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

export function ArticleBodyInspector({
  config: c,
  onConfigChange,
  themeColors,
}: ArticleBodyInspectorProps) {
  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-muted)">
          {BLOCK_LABELS["article-body"]}
        </p>
        <p className="text-xs text-(--color-muted) mt-1">
          Displays the article's HTML body content.
        </p>
      </div>

      {/* ── Prose toggle ───────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-(--color-border)">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={c.prose !== false}
            onChange={(e) => onConfigChange("prose", e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium">Apply prose styles</span>
        </label>
        <p className="text-xs text-(--color-muted) mt-1 ml-6">
          Adds typographic styling to headings, paragraphs, lists, etc.
        </p>
      </div>

      {/* ── Container layout + style ───────────────────────────────── */}
      <div className="p-3 overflow-y-auto">
        <ContainerBlockEditor
          config={c}
          setConfig={onConfigChange}
          themeColors={themeColors}
        />
      </div>

      <AnimationSection config={c} onConfigChange={onConfigChange} />
    </div>
  );
}
