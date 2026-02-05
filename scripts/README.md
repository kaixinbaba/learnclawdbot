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

## 部署相关

### sync-env-to-github.mjs / clear-env-from-github.mjs

同步/清除 GitHub Actions 的环境变量。

### translate-docs.sh

批量翻译文档到其他语言。
