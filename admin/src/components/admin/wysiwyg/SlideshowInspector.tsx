import { useState, useRef, useEffect } from "react";
import { EASING_OPTIONS } from "../blockShared";

const PRESET_WIDTHS = [
  "w-full",
  "w-1/2",
  "w-1/3",
  "w-1/4",
  "w-page",
  "w-screen",
];
const PRESET_HEIGHTS = ["h-auto", "h-48", "h-64", "h-96", "h-screen"];

function parsePx(v: string): number {
  return Math.max(1, parseInt(v.replace("px", ""), 10) || 400);
}

interface SlideshowInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}

export function SlideshowInspector({
  config: c,
  onConfigChange: set,
}: SlideshowInspectorProps) {
  const [sizingOpen, setSizingOpen] = useState(true);
  const [slideshowOpen, setSlideshowOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);

  const transition = (c.transition as string) ?? "slide";
  const width = (c.width as string) ?? "w-full";
  const height = (c.height as string) ?? "h-96";

  const isCustomWidth = !PRESET_WIDTHS.includes(width);
  const isCustomHeight = !PRESET_HEIGHTS.includes(height);

  const showHAutoWarning =
    height === "h-auto" && (transition === "fade" || transition === "scale");

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Slideshow Settings
        </span>
      </div>

      {/* ── SIZING ── */}
      <Section
        title="Sizing"
        open={sizingOpen}
        onToggle={() => setSizingOpen((o) => !o)}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-(--color-muted) mb-1">
              Width
            </label>
            <select
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              value={isCustomWidth ? "__custom__" : width}
              onChange={(e) => {
                if (e.target.value === "__custom__") set("width", "400px");
                else set("width", e.target.value);
              }}
            >
              <option value="w-full">Fill Container (100%)</option>
              <option value="w-1/2">Half (50%)</option>
              <option value="w-1/3">Third (33%)</option>
              <option value="w-1/4">Quarter (25%)</option>
              <option value="w-page">Page width (max-w-5xl)</option>
              <option value="w-screen">Full Screen (100vw)</option>
              <option value="__custom__">Custom (px)…</option>
            </select>
            {isCustomWidth && (
              <input
                type="number"
                min={1}
                step={10}
                placeholder="px"
                className="mt-1 w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                value={parsePx(width)}
                onChange={(e) => set("width", `${e.target.value}px`)}
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-(--color-muted) mb-1">
              Height
            </label>
            <select
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              value={isCustomHeight ? "__custom__" : height}
              onChange={(e) => {
                if (e.target.value === "__custom__") set("height", "400px");
                else set("height", e.target.value);
              }}
            >
              <option value="h-auto">Hug Contents (Auto)</option>
              <option value="h-48">Small (12rem)</option>
              <option value="h-64">Medium (16rem)</option>
              <option value="h-96">Large (24rem)</option>
              <option value="h-screen">Full Screen (100vh)</option>
              <option value="__custom__">Custom (px)…</option>
            </select>
            {isCustomHeight && (
              <input
                type="number"
                min={1}
                step={10}
                placeholder="px"
                className="mt-1 w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                value={parsePx(height)}
                onChange={(e) => set("height", `${e.target.value}px`)}
              />
            )}
          </div>
        </div>
        {showHAutoWarning && (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
            Auto height only works with the Slide transition. Fade and Scale
            need an explicit height.
          </p>
        )}
      </Section>

      {/* ── SLIDESHOW ── */}
      <Section
        title="Slideshow"
        open={slideshowOpen}
        onToggle={() => setSlideshowOpen((o) => !o)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Direction
              </label>
              <select
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                value={(c.direction as string) ?? "horizontal"}
                onChange={(e) => set("direction", e.target.value)}
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Transition
              </label>
              <select
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                value={transition}
                onChange={(e) => set("transition", e.target.value)}
              >
                <option value="slide">Slide</option>
                <option value="fade">Fade</option>
                <option value="scale">Scale</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Duration (ms)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                value={(c.duration as number) ?? 500}
                onChange={(e) => set("duration", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Easing
              </label>
              <select
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                value={(c.easing as string) ?? "ease-in-out"}
                onChange={(e) => set("easing", e.target.value)}
              >
                {EASING_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-(--color-muted) mb-1">
              Auto-advance delay (ms, 0 = off)
            </label>
            <input
              type="number"
              min={0}
              step={500}
              className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
              value={(c.autoAdvance as number) ?? 0}
              onChange={(e) => set("autoAdvance", Number(e.target.value))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={(c.loop as boolean) !== false}
              onChange={(e) => set("loop", e.target.checked)}
            />
            <span className="text-sm text-(--color-text)">
              Loop (wrap around)
            </span>
          </label>
        </div>
      </Section>

      {/* ── CONTROLS ── */}
      <Section
        title="Controls"
        open={controlsOpen}
        onToggle={() => setControlsOpen((o) => !o)}
      >
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={(c.showArrows as boolean) !== false}
              onChange={(e) => set("showArrows", e.target.checked)}
            />
            <span className="text-sm text-(--color-text)">Show arrows</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={(c.showDots as boolean) !== false}
              onChange={(e) => set("showDots", e.target.checked)}
            />
            <span className="text-sm text-(--color-text)">Show dots</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={(c.swipe as boolean) !== false}
              onChange={(e) => set("swipe", e.target.checked)}
            />
            <span className="text-sm text-(--color-text)">Enable swipe</span>
          </label>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={ref} className="border-t border-(--color-border)">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-(--color-muted) hover:bg-(--color-bg-surface)"
        onClick={onToggle}
      >
        {title}
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}
