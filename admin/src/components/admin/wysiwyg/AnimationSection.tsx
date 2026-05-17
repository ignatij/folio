import { useState, useRef, useEffect } from "react";
import { ANIMATION_TYPES, EASING_OPTIONS } from "../blockShared";
import type { AnimationType, EasingOption } from "../blockShared";

interface AnimationSectionProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}

export function AnimationSection({
  config,
  onConfigChange,
}: AnimationSectionProps) {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [open]);

  const animation = (config.animation as AnimationType | null) ?? null;
  const trigger = (config.animTrigger as string) ?? "scroll";
  const duration = (config.animDuration as number) ?? 600;
  const easing = (config.animEasing as EasingOption) ?? "ease-out";
  const delay = (config.animDelay as number) ?? 0;
  const once = (config.animOnce as boolean) ?? true;

  const hasAnim = !!animation && animation !== "none";

  return (
    <div ref={sectionRef} className="border-t border-(--color-border)">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-(--color-muted) hover:bg-(--color-bg-surface)"
        onClick={() => setOpen((o) => !o)}
      >
        Animation
        <span className="flex items-center gap-1.5">
          {hasAnim && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-accent) text-white font-normal normal-case">
              {animation}
            </span>
          )}
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Animation type */}
          <div>
            <label className="block text-xs text-(--color-muted) mb-1">
              Animation
            </label>
            <select
              className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
              value={animation ?? "none"}
              onChange={(e) =>
                onConfigChange(
                  "animation",
                  e.target.value === "none" ? null : e.target.value,
                )
              }
            >
              <option value="none">None (disabled)</option>
              {ANIMATION_TYPES.filter((a) => a !== "none").map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {hasAnim && (
            <>
              {/* Trigger */}
              <div>
                <label className="block text-xs text-(--color-muted) mb-1">
                  Trigger
                </label>
                <select
                  className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                  value={trigger}
                  onChange={(e) =>
                    onConfigChange("animTrigger", e.target.value)
                  }
                >
                  <option value="scroll">Scroll into view</option>
                  <option value="load">Page load</option>
                  <option value="hover">Hover</option>
                  <option value="click">Click</option>
                </select>
              </div>

              {/* Duration + Delay row */}
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
                    value={duration}
                    onChange={(e) =>
                      onConfigChange("animDuration", Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-(--color-muted) mb-1">
                    Delay (ms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                    value={delay}
                    onChange={(e) =>
                      onConfigChange("animDelay", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              {/* Easing */}
              <div>
                <label className="block text-xs text-(--color-muted) mb-1">
                  Easing
                </label>
                <select
                  className="w-full text-sm border border-(--color-border) rounded px-2 py-1.5 bg-(--color-bg)"
                  value={easing}
                  onChange={(e) => onConfigChange("animEasing", e.target.value)}
                >
                  {EASING_OPTIONS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              {/* Once toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-(--color-muted)">
                  Animate only once
                </label>
                <button
                  type="button"
                  onClick={() => onConfigChange("animOnce", !once)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${once ? "bg-(--color-accent)" : "bg-(--color-border)"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${once ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
