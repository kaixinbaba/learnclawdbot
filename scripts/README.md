# Scripts

项目维护和 SEO 检查工具集。所有脚本通过 `npx tsx` 运行。

## SEO 检查

### check-all-mdx-titles.ts

扫描所有 MDX 文件，检查 frontmatter 是否有有效的 `title` 字段。

```bash
npx tsx scripts/check-all-mdx-titles.ts
```

**用途：** 新增文档后跑一遍，确保不会因缺少 title 导致 SEO 问题。

### check-hreflang.ts

检查多语言翻译覆盖率 — 哪些文档缺少哪些语言的翻译。

```bash
npx tsx scripts/check-hreflang.ts
```

**用途：** 添加新语言或新文档后跑一遍，确认 hreflang 标签的一致性。

### check-seo-issues.ts

检查文档文件是否存在且 frontmatter 有效。支持全量扫描或指定 URL。

```bash
# 全量扫描所有文档
npx tsx scripts/check-seo-issues.ts

# 检查特定 URL
npx tsx scripts/check-seo-issues.ts /zh/docs/cli/browser /ja/docs/install/node

# 支持完整 URL
npx tsx scripts/check-seo-issues.ts https://www.learnclawdbot.org/zh/docs/reference/templates/AGENTS
```

**用途：** Ahrefs 报告问题 URL 时，直接粘贴 URL 批量检查。

### check-links.ts

检查 MDX 文件中的内部链接是否有效（broken links 检测）。

```bash
npx tsx scripts/check-links.ts
```

**用途：** 发布前跑一遍，避免上线后出现 404 链接。

## Blog Tags（分类与验证）

### blog-tag-taxonomy.ts

把 blog 的 slug → 分类(tag)规则沉淀为正式脚本，支持**检查模式**和**落库模式**。

```bash
# 检查（默认，不写库）
npx tsx scripts/blog-tag-taxonomy.ts

# 严格检查：若存在未映射 slug 则返回非 0（适合 CI）
npx tsx scripts/blog-tag-taxonomy.ts --strict

# 落库：补齐 blog tags 并建立 post_tags 关联（幂等）
npx tsx scripts/blog-tag-taxonomy.ts --apply
```

**用途：**
- 把临时 `_tmp_*` 阶段的分类规则固化为可复用脚本
- 回归检查 tags 数据完整性（是否有未映射 slug、是否有无标签文章）
- 作为 tag 过滤功能的最小可复现数据验证入口

## CMS 内容写入

### seed-c01-user-case-nix-openclaw.ts

写入 C01 用户案例（nix-openclaw 声明式部署）到 CMS 数据库（`posts` / `tags` / `post_tags`），包含 5 语言内容与标签关联，支持幂等重复执行。

```bash
# 推荐（package script）
pnpm cms:seed:c01

# 或直接执行
npx tsx scripts/seed-c01-user-case-nix-openclaw.ts
```

**用途：**
- 通过数据库方式发布用户案例（非 mdx 静态文件）
- 自动补齐标签并关联文章
- 同步更新指定 slug 的 5 语言内容

### seed-c02-user-case-padel-booking.ts

写入 C02 用户案例（padel-cli 订场自动化）到 CMS 数据库（`posts` / `tags` / `post_tags`），包含 5 语言内容与标签关联，支持幂等重复执行。

```bash
# 推荐（package script）
pnpm cms:seed:c02

# 或直接执行
npx tsx scripts/seed-c02-user-case-padel-booking.ts
```

**用途：**
- 以 CMS 流程发布 C02（不走 mdx 静态文件）
- 自动确保标签存在并关联
- 同步更新 C02 slug 的 5 语言内容

## 部署相关

### sync-env-to-github.mjs / clear-env-from-github.mjs

同步/清除 GitHub Actions 的环境变量。

### translate-docs.sh

批量翻译文档到其他语言。
