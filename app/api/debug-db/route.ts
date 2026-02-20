import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  const results: Record<string, unknown> = {};
  
  try {
    // 1. Check DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    results.hasDbUrl = !!dbUrl;
    results.dbUrlLength = dbUrl?.length || 0;
    results.dbUrlEndsWithNewline = dbUrl?.endsWith('\n') || dbUrl?.endsWith('\r');
    results.dbUrlContainsOptions = dbUrl?.includes('options=');
    results.dbUrlContainsSearchPath = dbUrl?.includes('search_path');
    
    // Extract host for debugging (hide password)
    if (dbUrl) {
      const match = dbUrl.match(/@([^:\/]+)/);
      results.dbHost = match ? match[1] : 'unknown';
    }
    
    // 2. Try to connect
    const sql = postgres(dbUrl!, { max: 1, idle_timeout: 5 });
    
    // 3. Check search_path
    const searchPathResult = await sql`SHOW search_path`;
    results.searchPath = searchPathResult[0]?.search_path;
    
    // 4. Try to query posts
    const postsCount = await sql`SELECT COUNT(*) as count FROM posts`;
    results.postsCount = postsCount[0]?.count;
    
    // 5. Get table columns
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' AND table_schema = 'learnclawdbot'
      ORDER BY ordinal_position
    `;
    results.columns = columns.map((c: any) => c.column_name);
    
    // 6. Try to get one blog
    const oneBlog = await sql`
      SELECT id, slug, language, post_type 
      FROM posts 
      WHERE post_type = 'blog' 
      LIMIT 1
    `;
    results.sampleBlog = oneBlog[0] || null;
    
    await sql.end();
    results.status = 'success';
    
  } catch (error) {
    results.status = 'error';
    results.error = error instanceof Error ? error.message : String(error);
    results.errorStack = error instanceof Error ? error.stack : undefined;
  }
  
  return NextResponse.json(results, { status: results.status === 'success' ? 200 : 500 });
}
