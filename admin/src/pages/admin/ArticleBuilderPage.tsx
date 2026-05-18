import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type {
  HomeBlock,
  Language,
  PaginatedArticles,
  Article,
} from "../../api/types";
import type { ArticleCtx } from "../../components/admin/wysiwyg/iframeRenderer";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";

export default function ArticleBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(
    null,
  );
  const qc = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  const { data: articlesData } = useQuery<PaginatedArticles>({
    queryKey: ["admin", "articles", "all"],
    queryFn: () => adminApi.listArticles(1, 100),
    staleTime: 60_000,
  });

  const { data: selectedArticle } = useQuery<Article>({
    queryKey: ["admin", "articles", selectedArticleId],
    queryFn: () => adminApi.getArticle(selectedArticleId!),
    enabled: selectedArticleId !== null,
    staleTime: 30_000,
  });

  // Seed blocks from settings
  useEffect(() => {
    if (settings?.article_sections) setBlocks(settings.article_sections);
  }, [settings]);

  // Set default language
  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  // Auto-select first article
  useEffect(() => {
    if (articlesData?.items?.length && selectedArticleId === null) {
      setSelectedArticleId(articlesData.items[0].id);
    }
  }, [articlesData, selectedArticleId]);

  // Build theme CSS vars for the iframe canvas
  useEffect(() => {
    const theme = settings?.theme;
    if (!theme?.colors) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.colors)) {
      vars[`--color-${k}`] = v;
    }
    if (theme.fonts?.body) vars["--font-body"] = theme.fonts.body;
    if (theme.fonts?.fallback) vars["--font-fallback"] = theme.fonts.fallback;
    setThemeVars(vars);
  }, [settings]);

  // Build ArticleCtx from the selected article + activeLang
  const articleCtx: ArticleCtx | null = (() => {
    if (!selectedArticle) return null;
    const t =
      selectedArticle.translations.find((tr) => tr.lang_code === activeLang) ??
      selectedArticle.translations[0];
    if (!t) return null;
    return {
      title: t.title,
      excerpt: t.excerpt,
      tag: t.tag,
      date: selectedArticle.published_at
        ? new Date(selectedArticle.published_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unpublished",
      cover: selectedArticle.cover_image_path
        ? `${window.location.origin}/uploads/${selectedArticle.cover_image_path}`
        : "",
      body: t.body,
    };
  })();

  const saveMutation = useMutation({
    mutationFn: (article_sections: HomeBlock[]) =>
      adminApi.saveSettings({
        article_sections,
        settings_updated_at: settings?.settings_updated_at,
      } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  const articles = articlesData?.items ?? [];

  function handleCopyBlocksFrom(fromLang: string) {
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        translations: {
          ...block.translations,
          [activeLang]: JSON.parse(
            JSON.stringify(
              block.translations?.[fromLang] ??
                block.translations?.[activeLang] ??
                {},
            ),
          ),
        },
      })),
    );
  }

  if (settingsLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="article"
      title="Article Layout Builder"
      subtitle={
        articles.length > 0 ? (
          <select
            value={selectedArticleId ?? ""}
            onChange={(e) => setSelectedArticleId(Number(e.target.value))}
            className="text-xs border border-(--color-border) rounded px-2 py-0.5 bg-(--color-bg) text-(--color-text) max-w-[220px]"
          >
            {articles.map((a) => {
              const t = a.translations[0];
              return (
                <option key={a.id} value={a.id}>
                  {t?.title ?? `Article #${a.id}`}{" "}
                  {a.translations.length > 1
                    ? `(${a.translations.map((tr) => tr.lang_code).join(", ")})`
                    : `(${t?.lang_code ?? ""})`}
                </option>
              );
            })}
          </select>
        ) : undefined
      }
      themeVars={themeVars}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      onCopyBlocksFrom={languages.length > 1 ? handleCopyBlocksFrom : undefined}
      blocks={blocks}
      onBlocksChange={(updated) => setBlocks(updated as HomeBlock[])}
      onSave={() => saveMutation.mutate(blocks)}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      articleCtx={articleCtx}
    />
  );
}
