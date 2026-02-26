import { listPublishedPostsForISR } from "@/actions/posts/posts-isr";
import { listTagsAction } from "@/actions/posts/tags";
import { POST_CONFIGS } from "@/components/cms/post-config";
import { PostList } from "@/components/cms/PostList";
import { Locale } from "@/i18n/routing";
import { constructMetadata } from "@/lib/metadata";
import { Tag } from "@/types/cms";
import { TextSearch } from "lucide-react";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<{ tag?: string | string[] }>;

type MetadataProps = {
  params: Params;
};

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blogs" });

  return constructMetadata({
    title: t("title"),
    description: t("description"),
    locale: locale as Locale,
    path: `/blog`,
  });
}

const SERVER_POST_PAGE_SIZE = 12;

function normalizeTagQuery(tagValue?: string | string[]): string | null {
  if (!tagValue) return null;
  const raw = Array.isArray(tagValue) ? tagValue[0] : tagValue;
  if (!raw) return null;
  return raw.trim().toLowerCase();
}

function toTagSlug(tagName: string): string {
  return tagName
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveTagByQuery(query: string | null, tags: Tag[]): Tag | null {
  if (!query) return null;

  return (
    tags.find((tag) => tag.id.toLowerCase() === query) ||
    tags.find((tag) => tag.name.toLowerCase() === query) ||
    tags.find((tag) => toTagSlug(tag.name) === query) ||
    null
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const t = await getTranslations({ locale, namespace: "Blogs" });

  const tagsResult = await listTagsAction({ postType: "blog" });

  const allTags: Tag[] =
    tagsResult.success && tagsResult.data?.tags
      ? tagsResult.data.tags.sort((a, b) => a.name.localeCompare(b.name))
      : [];

  const normalizedTagQuery = normalizeTagQuery(resolvedSearchParams.tag);
  const selectedTag = resolveTagByQuery(normalizedTagQuery, allTags);

  const initialServerPostsResult = await listPublishedPostsForISR({
    pageIndex: 0,
    pageSize: SERVER_POST_PAGE_SIZE,
    postType: "blog",
    locale: locale,
    tagId: selectedTag?.id ?? null,
  });

  const initialServerPosts =
    initialServerPostsResult.success && initialServerPostsResult.data?.posts
      ? initialServerPostsResult.data.posts
      : [];
  const totalServerPosts =
    initialServerPostsResult.success && initialServerPostsResult.data?.count
      ? initialServerPostsResult.data.count
      : 0;

  if (!initialServerPostsResult.success) {
    console.error(
      "Failed to fetch initial server posts:",
      initialServerPostsResult.error
    );
  }

  const noPostsFound = initialServerPosts.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">{t("title")}</h1>

      {noPostsFound ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <TextSearch className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">
            {t("emptyState.title") || "No blog posts"}
          </h2>
          <p className="text-gray-500 max-w-md">
            {t("emptyState.description") ||
              "We are creating exciting content, please stay tuned!"}
          </p>
        </div>
      ) : (
        <PostList
          postType="blog"
          baseUrl="/blog"
          localPosts={[]}
          initialPosts={initialServerPosts}
          initialTotal={totalServerPosts}
          initialSelectedTagId={selectedTag?.id ?? null}
          serverTags={allTags}
          locale={locale}
          pageSize={SERVER_POST_PAGE_SIZE}
          showTagSelector={true}
          showCover={POST_CONFIGS.blog.showCoverInList}
          emptyMessage="No posts found for this tag."
        />
      )}
    </div>
  );
}
