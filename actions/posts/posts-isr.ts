'use server'

/**
 * ISR-safe post actions - NO session/cookies imports
 * Use these for static generation and ISR pages
 */

import { DEFAULT_LOCALE } from '@/i18n/routing'
import { actionResponse } from '@/lib/action-response'
import { db, isDatabaseEnabled } from '@/lib/db'
import { posts as postsSchema, postTags as postTagsSchema, PostType, tags as tagsSchema } from '@/lib/db/schema'
import { getErrorMessage } from '@/lib/error-utils'
import { PublicPost, PublicPostWithContent } from '@/types/cms'
import { and, count, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { redis } from '@/lib/upstash'
import { LOWER_CASE_SITE_NAME } from '@/lib/upstash/redis-keys'

// ============ Types ============

interface GetPublishedPostBySlugParams {
  slug: string
  postType?: PostType
  locale?: string
}

interface GetPublishedPostBySlugResult {
  success: boolean
  data?: { post: PublicPostWithContent }
  error?: string
  customCode?: string
}

interface GetPostMetadataParams {
  slug: string
  postType: PostType
  locale?: string
}

interface PostMetadata {
  title: string
  description: string | null
  featuredImageUrl: string | null
  visibility: string
}

interface GetPostMetadataResult {
  success: boolean
  data?: { metadata: PostMetadata }
  error?: string
}

interface ListPublishedPostsParams {
  postType: PostType
  locale?: string
  pageIndex?: number
  pageSize?: number
  tagId?: string | null
  visibility?: 'public' | 'logged_in' | 'subscribers' | null
}

interface ListPublishedPostsResult {
  success: boolean
  data?: { posts: PublicPost[]; count: number }
  error?: string
}

// ============ Cache Helpers ============

const TAG_POST_IDS_CACHE_TTL_SECONDS = 60 * 60 * 24 // 24h

function getTagPostIdsCacheKey({
  tagId,
  postType,
  locale,
}: {
  tagId: string
  postType: PostType
  locale: string
}) {
  return `${LOWER_CASE_SITE_NAME}:cache:tag-post-ids:${postType}:${locale}:${tagId}`
}

async function getCachedTagPostIds({
  tagId,
  postType,
  locale,
}: {
  tagId: string
  postType: PostType
  locale: string
}): Promise<string[] | null> {
  if (!redis) return null

  try {
    const key = getTagPostIdsCacheKey({ tagId, postType, locale })
    const cached = await redis.get<string[]>(key)

    if (!cached) return null
    if (!Array.isArray(cached)) return null
    if (!cached.every((id) => typeof id === 'string')) return null

    return cached
  } catch {
    return null
  }
}

async function setCachedTagPostIds({
  tagId,
  postType,
  locale,
  postIds,
}: {
  tagId: string
  postType: PostType
  locale: string
  postIds: string[]
}): Promise<void> {
  if (!redis) return

  try {
    const key = getTagPostIdsCacheKey({ tagId, postType, locale })
    await redis.set(key, postIds, { ex: TAG_POST_IDS_CACHE_TTL_SECONDS })
  } catch {
    // best-effort cache; ignore cache write failures
  }
}

// ============ ISR-Safe Actions ============

/**
 * Get published post by slug - ISR safe (no auth check)
 * For non-public posts, returns metadata only without content
 */
export async function getPublishedPostBySlugForISR({
  slug,
  postType = 'blog',
  locale = 'en',
}: GetPublishedPostBySlugParams): Promise<GetPublishedPostBySlugResult> {
  if (!slug) {
    return actionResponse.badRequest('Slug is required.')
  }

  if (!isDatabaseEnabled) {
    return actionResponse.notFound('Database is disabled.')
  }

  try {
    const conditions = [
      eq(postsSchema.slug, slug),
      eq(postsSchema.language, locale),
      eq(postsSchema.status, 'published'),
      eq(postsSchema.postType, postType)
    ]

    const postData = await db
      .select()
      .from(postsSchema)
      .where(and(...conditions))
      .limit(1)

    if (!postData || postData.length === 0) {
      return actionResponse.notFound('Post not found.')
    }
    const post = postData[0]

    const tagsData = await db
      .select({ name: tagsSchema.name })
      .from(postTagsSchema)
      .innerJoin(tagsSchema, eq(postTagsSchema.tagId, tagsSchema.id))
      .where(eq(postTagsSchema.postId, post.id))

    const tagNames = tagsData.map((t) => t.name).join(', ') || null

    // For ISR: if post requires auth, return metadata only (no content)
    let finalContent = post.content ?? ''
    let restrictionCustomCode: string | undefined = undefined

    if (post.visibility === 'logged_in') {
      finalContent = ''
      restrictionCustomCode = 'unauthorized'
    } else if (post.visibility === 'subscribers') {
      finalContent = ''
      restrictionCustomCode = 'notSubscriber'
    }

    const postResultData: PublicPostWithContent = {
      ...post,
      content: finalContent,
      tags: tagNames,
    }

    if (restrictionCustomCode) {
      return actionResponse.success({ post: postResultData }, restrictionCustomCode)
    }

    return actionResponse.success({ post: postResultData })
  } catch (error) {
    console.error(
      `Get Published Post By Slug For ISR Failed for slug ${slug}, locale ${locale}:`,
      error
    )
    const errorMessage = getErrorMessage(error)
    return actionResponse.error(errorMessage)
  }
}

/**
 * Get post metadata - ISR safe
 */
export async function getPostMetadataForISR({
  slug,
  postType,
  locale = 'en',
}: GetPostMetadataParams): Promise<GetPostMetadataResult> {
  if (!slug) {
    return actionResponse.badRequest('Slug is required.')
  }

  if (!isDatabaseEnabled) {
    return actionResponse.notFound('Database is disabled.')
  }

  try {
    const conditions = [
      eq(postsSchema.slug, slug),
      eq(postsSchema.language, locale),
      eq(postsSchema.status, 'published'),
      eq(postsSchema.postType, postType)
    ]

    const postData = await db
      .select({
        title: postsSchema.title,
        description: postsSchema.description,
        featuredImageUrl: postsSchema.featuredImageUrl,
        visibility: postsSchema.visibility,
      })
      .from(postsSchema)
      .where(and(...conditions))
      .limit(1)

    if (!postData || postData.length === 0) {
      return actionResponse.notFound('Post not found.')
    }

    return actionResponse.success({
      metadata: {
        title: postData[0].title,
        description: postData[0].description,
        featuredImageUrl: postData[0].featuredImageUrl,
        visibility: postData[0].visibility,
      },
    })
  } catch (error) {
    console.error(
      `Get Post Metadata For ISR Failed for slug ${slug}, locale ${locale}:`,
      error
    )
    const errorMessage = getErrorMessage(error)
    return actionResponse.error(errorMessage)
  }
}

/**
 * List published posts - ISR safe
 */
export async function listPublishedPostsForISR({
  postType,
  locale = DEFAULT_LOCALE,
  pageIndex = 0,
  pageSize = 60,
  tagId = null,
  visibility = null,
}: ListPublishedPostsParams): Promise<ListPublishedPostsResult> {
  if (!isDatabaseEnabled) {
    return actionResponse.notFound('Database is disabled.')
  }

  try {
    const conditions = [
      eq(postsSchema.postType, postType),
      eq(postsSchema.language, locale),
      eq(postsSchema.status, 'published'),
    ]

    if (visibility) {
      conditions.push(eq(postsSchema.visibility, visibility))
    }

    // If tagId provided, get post IDs with that tag first (cached)
    let postIdsWithTag: string[] | null = null
    if (tagId) {
      const cachedPostIds = await getCachedTagPostIds({
        tagId,
        postType,
        locale,
      })

      if (cachedPostIds) {
        postIdsWithTag = cachedPostIds
      } else {
        const taggedPosts = await db
          .select({ postId: postTagsSchema.postId })
          .from(postTagsSchema)
          .where(eq(postTagsSchema.tagId, tagId))

        postIdsWithTag = taggedPosts.map((t) => t.postId)

        await setCachedTagPostIds({
          tagId,
          postType,
          locale,
          postIds: postIdsWithTag,
        })
      }

      if (postIdsWithTag.length === 0) {
        return actionResponse.success({ posts: [], count: 0 })
      }
      conditions.push(inArray(postsSchema.id, postIdsWithTag))
    }

    // Get count
    const countResult = await db
      .select({ count: count() })
      .from(postsSchema)
      .where(and(...conditions))

    const totalCount = countResult[0]?.count ?? 0

    // Get posts
    const postsData = await db
      .select({
        id: postsSchema.id,
        title: postsSchema.title,
        slug: postsSchema.slug,
        description: postsSchema.description,
        featuredImageUrl: postsSchema.featuredImageUrl,
        isPinned: postsSchema.isPinned,
        visibility: postsSchema.visibility,
        publishedAt: postsSchema.publishedAt,
        createdAt: postsSchema.createdAt,
        status: postsSchema.status,
        language: postsSchema.language,
        postType: postsSchema.postType,
      })
      .from(postsSchema)
      .where(and(...conditions))
      .orderBy(desc(postsSchema.isPinned), desc(postsSchema.publishedAt))
      .limit(pageSize)
      .offset(pageIndex * pageSize)

    // Get tags for each post
    const postIds = postsData.map((p) => p.id)
    let tagsMap: Record<string, string[]> = {}

    if (postIds.length > 0) {
      const tagsData = await db
        .select({
          postId: postTagsSchema.postId,
          tagName: tagsSchema.name,
        })
        .from(postTagsSchema)
        .innerJoin(tagsSchema, eq(postTagsSchema.tagId, tagsSchema.id))
        .where(inArray(postTagsSchema.postId, postIds))

      for (const t of tagsData) {
        if (!tagsMap[t.postId]) {
          tagsMap[t.postId] = []
        }
        tagsMap[t.postId].push(t.tagName)
      }
    }

    const posts: PublicPost[] = postsData.map((p) => ({
      ...p,
      tags: tagsMap[p.id]?.join(', ') || null,
    }))

    return actionResponse.success({ posts, count: totalCount })
  } catch (error) {
    console.error(`List Published Posts For ISR Failed:`, error)
    const errorMessage = getErrorMessage(error)
    return actionResponse.error(errorMessage)
  }
}

// ============ Related Posts (ISR Safe) ============

interface GetRelatedPostsParams {
  postId: string
  postType: PostType
  locale?: string
  limit?: number
}

interface GetRelatedPostsResult {
  success: boolean
  data?: { posts: PublicPost[] }
  error?: string
}

/**
 * Get related posts - ISR safe
 */
export async function getRelatedPostsForISR({
  postId,
  postType,
  locale = 'en',
  limit = 10,
}: GetRelatedPostsParams): Promise<GetRelatedPostsResult> {
  if (!isDatabaseEnabled) {
    return actionResponse.success({ posts: [] })
  }

  try {
    // Get tags for the current post
    const postTagsData = await db
      .select({ tagId: postTagsSchema.tagId })
      .from(postTagsSchema)
      .where(eq(postTagsSchema.postId, postId))
      .limit(1)

    if (!postTagsData || postTagsData.length === 0) {
      return actionResponse.success({ posts: [] })
    }

    const tagId = postTagsData[0].tagId

    // Find other posts with the same tag
    const relatedPostIds = await db
      .select({ postId: postTagsSchema.postId })
      .from(postTagsSchema)
      .where(eq(postTagsSchema.tagId, tagId))

    const postIdsArray = relatedPostIds
      .map((r) => r.postId)
      .filter((id) => id !== postId)

    if (postIdsArray.length === 0) {
      return actionResponse.success({ posts: [] })
    }

    // Get the related posts with tag names
    const postsSubquery = db
      .$with('posts_with_tags')
      .as(
        db
          .select({
            ...getTableColumns(postsSchema),
            tag_ids: sql<string[]>`array_agg(${postTagsSchema.tagId})`.as('tag_ids'),
            tag_names: sql<string[]>`array_agg(${tagsSchema.name})`.as('tag_names'),
          })
          .from(postsSchema)
          .leftJoin(postTagsSchema, eq(postsSchema.id, postTagsSchema.postId))
          .leftJoin(tagsSchema, eq(postTagsSchema.tagId, tagsSchema.id))
          .where(
            and(
              inArray(postsSchema.id, postIdsArray),
              eq(postsSchema.status, 'published'),
              eq(postsSchema.postType, postType),
              eq(postsSchema.language, locale),
            )
          )
          .groupBy(postsSchema.id)
      )

    const data = await db
      .with(postsSubquery)
      .select()
      .from(postsSubquery)
      .orderBy(
        desc(postsSubquery.isPinned),
        desc(postsSubquery.publishedAt),
        desc(postsSubquery.createdAt)
      )
      .limit(limit)

    const postsWithProcessedTags = (data || []).map((post) => {
      const tagNames = post.tag_names?.filter(Boolean).join(', ') || null
      const { tag_ids, tag_names, content, ...restOfPost } = post
      return {
        ...restOfPost,
        tags: tagNames,
      }
    })

    return actionResponse.success({
      posts: postsWithProcessedTags as unknown as PublicPost[],
    })
  } catch (error) {
    console.error('Get Related Posts For ISR Failed:', error)
    const errorMessage = getErrorMessage(error)
    return actionResponse.error(errorMessage)
  }
}
