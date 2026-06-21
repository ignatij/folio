/**
 * Inspector for "template" block types (hero, cta-band, rich-text, etc.).
 * Handles both home mode (text in translations[lang]) and page mode (text in config).
 */
import { useState } from "react";
import type {
  HomeBlock,
  PageBlock,
  BlockType,
  NavLink,
  SocialLink,
} from "../../../api/types";
import { RichTextEditor } from "../RichTextEditor";
import { MediaPickerModal } from "../MediaPickerModal";
import { Field } from "../blockShared";
import { BLOCK_LABELS } from "../blockShared";
import { NavBlockInspector } from "./NavBlockInspector";
import {
  SpacingSection,
  ElementIdSection,
  CustomStyleSection,
} from "./InspectorShared";

interface TemplateInspectorProps {
  block: HomeBlock | PageBlock;
  mode: "home" | "page" | "article";
  activeLang: string;
  onConfigChange: (key: string, value: unknown) => void;
  onTransChange: (key: string, value: string) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}

type PastPerformanceItem = {
  date?: string;
  title?: string;
  location?: string;
  image?: string;
  url?: string;
  summary?: string;
  media?: string[];
  program?: Array<{ label?: string; value?: string }>;
  images?: Array<{ src?: string; alt?: string }>;
  videos?: Array<{ title?: string; youtubeEmbedUrl?: string }>;
};

export function TemplateInspector({
  block,
  mode,
  activeLang,
  onConfigChange,
  onTransChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: TemplateInspectorProps) {
  const type = block.type as BlockType;

  // Derive text field value depending on mode
  const t = (key: string): string => {
    if (mode === "home") {
      const hb = block as HomeBlock;
      return (hb.translations?.[activeLang]?.[key] as string) ?? "";
    }
    return (block.config[key] as string) ?? "";
  };

  const setT = (key: string, value: string) => onTransChange(key, value);

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          {BLOCK_LABELS[type] ?? type} Settings
        </span>
      </div>
      <div className="p-3 overflow-y-auto space-y-3">
        <BlockTypeFields
          block={block}
          type={type}
          t={t}
          setT={setT}
          onConfigChange={onConfigChange}
          themeColors={themeColors}
          navSnapshot={navSnapshot}
          footerSnapshot={footerSnapshot}
          socialSnapshot={socialSnapshot}
        />
      </div>
    </div>
  );
}

// ── Per-type field forms ───────────────────────────────────────────────────────

function BlockTypeFields({
  block,
  type,
  t,
  setT,
  onConfigChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: {
  block: HomeBlock | PageBlock;
  type: BlockType;
  t: (key: string) => string;
  setT: (key: string, value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}) {
  const [mediaPicker, setMediaPicker] = useState<string | null>(null);
  const [galleryTargetIndex, setGalleryTargetIndex] = useState<number | null>(
    null,
  );

  switch (type) {
    case "hero":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Subheadline"
            value={t("subheadline")}
            onChange={(v) => setT("subheadline", v)}
          />
          <Field
            label="CTA label"
            value={t("cta_label")}
            onChange={(v) => setT("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={t("cta_url")}
            onChange={(v) => setT("cta_url", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">
              Background image
            </label>
            <ImagePickButton
              src={block.config.bg_image as string}
              onPick={() => setMediaPicker("bg_image")}
              onRemove={() => onConfigChange("bg_image", "")}
            />
          </div>
          {mediaPicker === "bg_image" && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                onConfigChange("bg_image", `/uploads/${f.filename}`);
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    case "schedule": {
      const items = Array.isArray(block.config.items)
        ? (block.config.items as Array<Record<string, string>>)
        : [];
      const updateItems = (next: Array<Record<string, string>>) =>
        onConfigChange("items", next);
      const updateItem = (
        index: number,
        key: "date" | "title" | "location" | "detailUrl",
        value: string,
      ) => {
        updateItems(
          items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
        );
      };
      return (
        <>
          <Field
            label="Eyebrow"
            value={t("eyebrow")}
            onChange={(v) => setT("eyebrow", v)}
          />
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium">Events</label>
              <button
                type="button"
                onClick={() =>
                  updateItems([
                    ...items,
                    {
                      date: "",
                      title: "New event",
                      location: "",
                      detailUrl: "",
                    },
                  ])
                }
                className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
              >
                Add event
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-(--color-border) p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                      Event {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateItems(items.filter((_, i) => i !== index))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <Field
                    label="Date"
                    value={item.date ?? ""}
                    onChange={(v) => updateItem(index, "date", v)}
                  />
                  <Field
                    label="Title"
                    value={item.title ?? ""}
                    onChange={(v) => updateItem(index, "title", v)}
                  />
                  <Field
                    label="Location"
                    value={item.location ?? ""}
                    onChange={(v) => updateItem(index, "location", v)}
                  />
                  <Field
                    label="Details URL"
                    value={item.detailUrl ?? ""}
                    onChange={(v) => updateItem(index, "detailUrl", v)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );
    }

    case "gallery": {
      const items = Array.isArray(block.config.items)
        ? (block.config.items as Array<Record<string, string>>)
        : [];
      const updateItems = (next: Array<Record<string, string>>) =>
        onConfigChange("items", next);
      const updateItem = (
        index: number,
        key: "src" | "alt",
        value: string,
      ) => {
        updateItems(
          items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
        );
      };
      return (
        <>
          <Field
            label="Eyebrow"
            value={t("eyebrow")}
            onChange={(v) => setT("eyebrow", v)}
          />
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Columns</label>
              <input
                type="number"
                min={1}
                max={4}
                value={(block.config.columns as number) ?? 3}
                onChange={(e) =>
                  onConfigChange("columns", Number(e.target.value))
                }
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Image height
              </label>
              <input
                type="number"
                min={120}
                max={800}
                value={(block.config.imageHeight as number) ?? 300}
                onChange={(e) =>
                  onConfigChange("imageHeight", Number(e.target.value))
                }
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium">Images</label>
              <button
                type="button"
                onClick={() =>
                  updateItems([...items, { src: "", alt: "Gallery image" }])
                }
                className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
              >
                Add image
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-(--color-border) p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                      Image {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateItems(items.filter((_, i) => i !== index))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Image
                    </label>
                    <ImagePickButton
                      src={item.src}
                      onPick={() => {
                        setGalleryTargetIndex(index);
                        setMediaPicker(`gallery-${index}`);
                      }}
                      onRemove={() => updateItem(index, "src", "")}
                    />
                  </div>
                  <Field
                    label="Alt text"
                    value={item.alt ?? ""}
                    onChange={(v) => updateItem(index, "alt", v)}
                  />
                </div>
              ))}
            </div>
          </div>
          {mediaPicker?.startsWith("gallery-") && galleryTargetIndex !== null && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                updateItem(
                  galleryTargetIndex,
                  "src",
                  `/uploads/${f.filename}`,
                );
                setGalleryTargetIndex(null);
                setMediaPicker(null);
              }}
              onClose={() => {
                setGalleryTargetIndex(null);
                setMediaPicker(null);
              }}
            />
          )}
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );
    }

    case "recordings": {
      const items = Array.isArray(block.config.items)
        ? (block.config.items as Array<Record<string, string>>)
        : [];
      const updateItems = (next: Array<Record<string, string>>) =>
        onConfigChange("items", next);
      const updateItem = (
        index: number,
        key: "title" | "src",
        value: string,
      ) => {
        updateItems(
          items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
        );
      };
      return (
        <>
          <Field
            label="Eyebrow"
            value={t("eyebrow")}
            onChange={(v) => setT("eyebrow", v)}
          />
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium">Videos</label>
              <button
                type="button"
                onClick={() =>
                  updateItems([
                    ...items,
                    {
                      title: "New recording",
                      src: "https://www.youtube.com/embed/",
                    },
                  ])
                }
                className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
              >
                Add video
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-(--color-border) p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                      Video {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateItems(items.filter((_, i) => i !== index))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <Field
                    label="Title"
                    value={item.title ?? ""}
                    onChange={(v) => updateItem(index, "title", v)}
                  />
                  <Field
                    label="Embed URL"
                    value={item.src ?? ""}
                    onChange={(v) => updateItem(index, "src", v)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );
    }

    case "past-performances": {
      const items = Array.isArray(block.config.items)
        ? (block.config.items as PastPerformanceItem[])
        : [];
      const updateItems = (next: PastPerformanceItem[]) =>
        onConfigChange("items", next);
      const updateItem = (
        index: number,
        patch: Partial<PastPerformanceItem>,
      ) => {
        updateItems(
          items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );
      };
      const updateProgram = (
        itemIndex: number,
        programIndex: number,
        key: "label" | "value",
        value: string,
      ) => {
        const program = items[itemIndex]?.program ?? [];
        updateItem(itemIndex, {
          program: program.map((row, i) =>
            i === programIndex ? { ...row, [key]: value } : row,
          ),
        });
      };
      const updateDetailImage = (
        itemIndex: number,
        imageIndex: number,
        patch: { src?: string; alt?: string },
      ) => {
        const images = items[itemIndex]?.images ?? [];
        updateItem(itemIndex, {
          images: images.map((image, i) =>
            i === imageIndex ? { ...image, ...patch } : image,
          ),
        });
      };
      const updateVideo = (
        itemIndex: number,
        videoIndex: number,
        patch: { title?: string; youtubeEmbedUrl?: string },
      ) => {
        const videos = items[itemIndex]?.videos ?? [];
        updateItem(itemIndex, {
          videos: videos.map((video, i) =>
            i === videoIndex ? { ...video, ...patch } : video,
          ),
        });
      };

      return (
        <>
          <Field
            label="Eyebrow"
            value={t("eyebrow")}
            onChange={(v) => setT("eyebrow", v)}
          />
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium">Performances</label>
              <button
                type="button"
                onClick={() =>
                  updateItems([
                    ...items,
                    {
                      date: "",
                      title: "New Performance",
                      location: "",
                      image: "",
                      url: "",
                      summary: "",
                      media: ["Photos", "YouTube"],
                      program: [],
                      images: [],
                      videos: [],
                    },
                  ])
                }
                className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
              >
                Add performance
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-(--color-border) p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                      Performance {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateItems(items.filter((_, i) => i !== index))
                      }
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <Field
                    label="Date"
                    value={item.date ?? ""}
                    onChange={(v) => updateItem(index, { date: v })}
                  />
                  <Field
                    label="Title"
                    value={item.title ?? ""}
                    onChange={(v) => updateItem(index, { title: v })}
                  />
                  <Field
                    label="Location"
                    value={item.location ?? ""}
                    onChange={(v) => updateItem(index, { location: v })}
                  />
                  <Field
                    label="Detail URL"
                    value={item.url ?? ""}
                    onChange={(v) => updateItem(index, { url: v })}
                  />
                  <p className="text-[10px] text-(--color-muted)">
                    Leave blank to auto-generate a past-performance URL from the
                    title, date, and location.
                  </p>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Card / hero image
                    </label>
                    <ImagePickButton
                      src={item.image}
                      onPick={() => setMediaPicker(`past-main-${index}`)}
                      onRemove={() => updateItem(index, { image: "" })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Summary
                    </label>
                    <textarea
                      rows={3}
                      value={item.summary ?? ""}
                      onChange={(e) =>
                        updateItem(index, { summary: e.target.value })
                      }
                      className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-y"
                    />
                  </div>

                  <Field
                    label="Media labels"
                    value={(item.media ?? []).join(", ")}
                    onChange={(v) =>
                      updateItem(index, {
                        media: v
                          .split(",")
                          .map((label) => label.trim())
                          .filter(Boolean),
                      })
                    }
                  />

                  <div className="space-y-2 pt-2 border-t border-(--color-border)">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium">
                        Repertoire
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(index, {
                            program: [
                              ...(item.program ?? []),
                              { label: "", value: "" },
                            ],
                          })
                        }
                        className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
                      >
                        Add row
                      </button>
                    </div>
                    {(item.program ?? []).map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-2 gap-2">
                        <input
                          value={row.label ?? ""}
                          onChange={(e) =>
                            updateProgram(
                              index,
                              rowIndex,
                              "label",
                              e.target.value,
                            )
                          }
                          placeholder="Composer / label"
                          className="px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                        />
                        <div className="flex gap-1">
                          <input
                            value={row.value ?? ""}
                            onChange={(e) =>
                              updateProgram(
                                index,
                                rowIndex,
                                "value",
                                e.target.value,
                              )
                            }
                            placeholder="Work / value"
                            className="min-w-0 flex-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(index, {
                                program: (item.program ?? []).filter(
                                  (_, i) => i !== rowIndex,
                                ),
                              })
                            }
                            className="text-xs text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-(--color-border)">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium">
                        Detail photos
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(index, {
                            images: [
                              ...(item.images ?? []),
                              { src: "", alt: item.title ?? "" },
                            ],
                          })
                        }
                        className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
                      >
                        Add photo
                      </button>
                    </div>
                    {(item.images ?? []).map((image, imageIndex) => (
                      <div
                        key={imageIndex}
                        className="rounded border border-(--color-border) p-2 space-y-2"
                      >
                        <ImagePickButton
                          src={image.src}
                          onPick={() =>
                            setMediaPicker(`past-image-${index}-${imageIndex}`)
                          }
                          onRemove={() =>
                            updateDetailImage(index, imageIndex, { src: "" })
                          }
                        />
                        <Field
                          label="Alt text"
                          value={image.alt ?? ""}
                          onChange={(v) =>
                            updateDetailImage(index, imageIndex, { alt: v })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, {
                              images: (item.images ?? []).filter(
                                (_, i) => i !== imageIndex,
                              ),
                            })
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove photo
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-(--color-border)">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium">
                        YouTube videos
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(index, {
                            videos: [
                              ...(item.videos ?? []),
                              { title: "", youtubeEmbedUrl: "" },
                            ],
                          })
                        }
                        className="text-xs px-2 py-1 rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
                      >
                        Add video
                      </button>
                    </div>
                    {(item.videos ?? []).map((video, videoIndex) => (
                      <div
                        key={videoIndex}
                        className="rounded border border-(--color-border) p-2 space-y-2"
                      >
                        <Field
                          label="Title"
                          value={video.title ?? ""}
                          onChange={(v) =>
                            updateVideo(index, videoIndex, { title: v })
                          }
                        />
                        <Field
                          label="YouTube embed URL"
                          value={video.youtubeEmbedUrl ?? ""}
                          onChange={(v) =>
                            updateVideo(index, videoIndex, {
                              youtubeEmbedUrl: v,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, {
                              videos: (item.videos ?? []).filter(
                                (_, i) => i !== videoIndex,
                              ),
                            })
                          }
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove video
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mediaPicker?.startsWith("past-main-") && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                const index = Number(mediaPicker.replace("past-main-", ""));
                updateItem(index, { image: `/uploads/${f.filename}` });
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}
          {mediaPicker?.startsWith("past-image-") && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                const [, , itemIndexRaw, imageIndexRaw] =
                  mediaPicker.split("-");
                updateDetailImage(Number(itemIndexRaw), Number(imageIndexRaw), {
                  src: `/uploads/${f.filename}`,
                });
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}

          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );
    }

    case "featured-articles":
    case "latest-articles":
      return (
        <>
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Max items</label>
            <input
              type="number"
              min={1}
              max={20}
              value={(block.config.max_count as number) ?? 6}
              onChange={(e) =>
                onConfigChange("max_count", Number(e.target.value))
              }
              className="w-24 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    case "cta-band":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Body"
            value={t("body")}
            onChange={(v) => setT("body", v)}
          />
          <Field
            label="CTA label"
            value={t("cta_label")}
            onChange={(v) => setT("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={t("cta_url")}
            onChange={(v) => setT("cta_url", v)}
          />
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    case "rich-text":
      return (
        <div className="divide-y divide-(--color-border)">
          <div className="px-3 py-2">
            <p className="text-[11px] text-(--color-muted) leading-relaxed">
              Double-click the block on the canvas to open the rich text editor.
            </p>
          </div>
          <div className="p-3 space-y-0 divide-y divide-(--color-border)">
            <SpacingSection config={block.config} onChange={onConfigChange} />
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </div>
      );

    case "image-text":
      return (
        <>
          <div>
            <label className="block text-xs font-medium mb-1">Image</label>
            <ImagePickButton
              src={block.config.image_url as string}
              onPick={() => setMediaPicker("image_url")}
              onRemove={() => onConfigChange("image_url", "")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Image position
            </label>
            <select
              value={(block.config.image_position as string) ?? "left"}
              onChange={(e) => onConfigChange("image_position", e.target.value)}
              className="px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Body</label>
            <RichTextEditor
              value={t("body")}
              onChange={(v) => setT("body", v)}
            />
          </div>
          {mediaPicker === "image_url" && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                onConfigChange("image_url", `/uploads/${f.filename}`);
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    case "testimonials":
      return (
        <>
          <TestimonialsEditor
            block={block}
            t={t}
            setT={setT}
            onConfigChange={onConfigChange}
          />
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    case "newsletter":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Body"
            value={t("body")}
            onChange={(v) => setT("body", v)}
          />
          <Field
            label="Email placeholder"
            value={t("placeholder")}
            onChange={(v) => setT("placeholder", v)}
          />
          <Field
            label="Button label"
            value={t("button_label")}
            onChange={(v) => setT("button_label", v)}
          />
          <Field
            label="Success message"
            value={t("success_message")}
            onChange={(v) => setT("success_message", v)}
          />
          <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </>
      );

    default:
      if (
        type === "nav-links" ||
        type === "subnav-links" ||
        type === "single-nav-item" ||
        type === "social-links" ||
        type === "single-social-link"
      ) {
        return (
          <NavBlockInspector
            type={type}
            config={block.config}
            onConfigChange={onConfigChange}
            themeColors={themeColors}
            navSnapshot={navSnapshot}
            footerSnapshot={footerSnapshot}
            socialSnapshot={socialSnapshot}
          />
        );
      }
      return (
        <p className="text-sm text-(--color-muted)">
          No editable fields for this block type.
        </p>
      );
  }
}

// ── Testimonials sub-editor ───────────────────────────────────────────────────

type Testimonial = { quote: string; author: string; role: string };

function TestimonialsEditor({
  block,
  t,
  setT,
  onConfigChange,
}: {
  block: HomeBlock | PageBlock;
  t: (key: string) => string;
  setT: (key: string, value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const items: Testimonial[] = (block.config.items as Testimonial[]) ?? [];

  function update(idx: number, patch: Partial<Testimonial>) {
    onConfigChange(
      "items",
      items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );
  }
  function add() {
    onConfigChange("items", [...items, { quote: "", author: "", role: "" }]);
  }
  function remove(idx: number) {
    onConfigChange(
      "items",
      items.filter((_, i) => i !== idx),
    );
  }

  return (
    <>
      <Field
        label="Section title"
        value={t("title")}
        onChange={(v) => setT("title", v)}
      />
      {items.map((item, idx) => (
        <div
          key={idx}
          className="p-3 rounded border border-(--color-border) space-y-2"
        >
          <div>
            <label className="text-xs font-medium">Quote</label>
            <textarea
              rows={2}
              value={item.quote}
              onChange={(e) => update(idx, { quote: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Author</label>
              <input
                type="text"
                value={item.author}
                onChange={(e) => update(idx, { author: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Role</label>
              <input
                type="text"
                value={item.role}
                onChange={(e) => update(idx, { role: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
          </div>
          <button
            onClick={() => remove(idx)}
            className="text-xs text-(--color-destructive) hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-sm text-(--color-accent) hover:underline"
      >
        + Add testimonial
      </button>
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ImagePickButton({
  src,
  onPick,
  onRemove,
}: {
  src: string | null | undefined;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      {!!src && (
        <img
          src={src}
          alt=""
          className="h-10 w-16 object-cover rounded border border-(--color-border)"
        />
      )}
      <button
        type="button"
        onClick={onPick}
        className="px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
      >
        {src ? "Change image" : "Pick image"}
      </button>
      {!!src && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-(--color-destructive)"
        >
          Remove
        </button>
      )}
    </div>
  );
}
