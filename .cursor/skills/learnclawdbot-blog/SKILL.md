---
name: learnclawdbot-blog
description: CMS-first workflow for multilingual OpenClaw user-case publishing (C01/C02/C03 standard)
---

# learnclawdbot-blog

## Scope

Use this skill when publishing **user cases** to learnclawdbot via **CMS database flow** (not static `blogs/*.mdx`).

## CMS User Case Flow (Reusable Checklist)

### 0) Git safety
- `git checkout main && git pull origin main`
- create feature branch (never push directly to `main`)

### 1) Topic selection & source validation
- Build a candidate pool first.
- Choose one highest-priority topic with verifiable primary sources.
- Do not claim metrics that sources do not provide.
- In article body, separate:
  - ✅ confirmed facts
  - ⚠️ pending validation

### 2) Multilingual content files
- Create `data/cms/{case-id}/{lang}.md` for:
  - `en`, `zh`, `ja`, `ko`, `ru`
- Keep frontmatter complete in all locales:
  - `title`
  - `description`
- Maintain consistent section structure across locales.

### 3) Seed script (idempotent upsert)
- Add `scripts/seed-{case}.ts`
- Add package script `cms:seed:{case}`
- Must upsert by `(slug, language, post_type)`.
- Re-run behavior:
  - first run: inserted
  - second run: updated
- **Hard gate (mandatory):** Do **not** consider the task complete unless `pnpm cms:seed:{case}` has been executed in this run and output has been captured in the delivery notes.
- **Hard gate (mandatory):** Verify DB write result after seeding (slug + 5 locales + featured_image_url + tags) via SQL/query output; screenshots/page-only checks are not enough.
- **Hard gate (mandatory):** If seed is not executed, status must be reported as `NOT_DONE` (not “done”).

### 4) Tags & filtering
- Include tag `User Cases`.
- Add 1-2 highly related tags.
- Ensure `/blog?tag=user-cases` preselect works on first render.
- Keep homepage HERO `getStartedLink` pointing to `/blog?tag=user-cases` in all 5 locale JSON files.

### 5) SEO / i18n
- Detail page TDK must come from CMS localized `title` / `description`.
- Validate at least one page per locale after seeding.

### 6) Featured image
- Generate **new** image (no reuse).
- Filename must be slug-aligned: `/public/images/blog/{slug}.webp`
- **Mandatory rule**: 所有博客头图必须使用 webp，禁止提交 raw/png/svg 作为最终头图。
- Must be directly accessible by URL.
- Keep size as small as practical (target < 200KB).
- Target canvas should be `1200x630` (crop/pad proportionally when source ratio differs).

### 7) Validation gate
- `pnpm cms:seed:{case}` run twice (verify updated on second run)
- `pnpm tsc --noEmit`
- Validate pages:
  - 5 locale detail pages
  - blog list tag prefilter
  - locale-specific title/description
  - featured image URL + file size
- **Release gate (mandatory):** No PR/release status until seed logs + DB verification output are included.

### 8) Delivery
- clean commits
- push branch
- create PR to `main`
- include:
  - PR link
  - file-level change list
  - verification checklist (✅/❌)
  - source mapping for each key conclusion

## C03 Pitfalls & Fixes (SNAG case)

1. **Source drift risk**
   - Showcase cards are short; key capability claims should be anchored in project README.
2. **Raw README branch mismatch**
   - Some repos use `master`, not `main`.
3. **Overclaim risk**
   - Do not invent ROI metrics (time saved, success lift) without telemetry/interview.
4. **Tag consistency**
   - Reuse existing translated tag names when possible to avoid UI i18n fallback noise.
