import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts as postsSchema, tags as tagsSchema, postTags as postTagsSchema } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") || "browser-relay";
  const locale = url.searchParams.get("locale") || "en";
  
  const results: Record<string, unknown> = {
    slug,
    locale,
  };
  
  try {
    // Step 1: Query post
    const conditions = [
      eq(postsSchema.slug, slug),
      eq(postsSchema.language, locale),
      eq(postsSchema.status, 'published'),
      eq(postsSchema.postType, 'blog')
    ];

    results.step = "querying post";
    const postData = await db
      .select()
      .from(postsSchema)
      .where(and(...conditions))
      .limit(1);

    results.postFound = postData.length > 0;
    
    if (postData.length > 0) {
      const post = postData[0];
      results.postId = post.id;
      results.postTitle = post.title;
      results.postSlug = post.slug;
      results.postLanguage = post.language;
      
      // Step 2: Query tags
      results.step = "querying tags";
      const tagsData = await db
        .select({ name: tagsSchema.name })
        .from(postTagsSchema)
        .innerJoin(tagsSchema, eq(postTagsSchema.tagId, tagsSchema.id))
        .where(eq(postTagsSchema.postId, post.id));
      
      results.tagsCount = tagsData.length;
      results.tags = tagsData.map(t => t.name);
    }
    
    results.status = "success";
    
  } catch (error) {
    results.status = "error";
    results.error = error instanceof Error ? error.message : String(error);
    results.errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined;
  }
  
  return NextResponse.json(results, { status: results.status === "success" ? 200 : 500 });
}
