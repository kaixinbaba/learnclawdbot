# Content Implementation Timeline & Workflow (30 Days)

This document outlines the operational process for delivering 15+ high-quality articles within the next 30 days to secure Google AdSense approval and drive SEO growth.

---

## 1. The "English-First" Publication Workflow

To maintain quality across 5 languages (EN, ZH, JA, KO, RU), we will follow a tiered production pipeline:

### Step 1: Research & Drafting (CMO)
- **Tool:** Google Search, OpenClaw Source Code, Community Discord.
- **Output:** High-quality English MDX file with proper frontmatter.
- **Focus:** E-E-A-T (Authoritative voice, technical accuracy, unique insights).

### Step 2: AI-Assisted Translation (CMO + LLM)
- **Tool:** `translate_docs.py` (customized for blog content).
- **Process:** Use Claude 3.5 Sonnet to translate the English source while preserving technical terms and MDX formatting.
- **Review:** Manual spot-check of ZH/JA/KO/RU versions for formatting consistency.

### Step 3: Database Ingestion (CMO)
- **Tool:** `scripts/migrate-docs.ts` (modified for blog posts).
- **Process:** Bulk upsert MDX files to the `posts` table.
- **Action:** Set `status: 'published'`, `postType: 'blog'`, and `visibility: 'public'`.

### Step 4: Distribution & Indexing (CMO)
- **Tool:** Google Search Console, X (Twitter), Reddit.
- **Action:** Submit new URLs for indexing and share on social platforms.

---

## 2. 30-Day Production Schedule

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| **Week 1** | **Foundations & Comparison** | 4 Articles: Claude Code vs OpenClaw, DeepSeek Integration, RPi 5 Guide, Top 10 Plugins. |
| **Week 2** | **Voice & Integrations** | 4 Articles: Voice Assistant Tutorial, WhatsApp Automation, Slack Integration, Troubleshooting Guide. |
| **Week 3** | **Advanced Automation** | 4 Articles: Tool Manifest Guide, Ollama Privacy Guide, Home Assistant Integration, Linear Workflow. |
| **Week 4** | **Roadmap & Ecosystem** | 3 Articles: 2026 Roadmap, OpenClaw vs AutoGPT, Best Practices for Large Context. |

---

## 3. Trust Signal Enhancements (P0)

Before re-submitting to AdSense, the following MUST be implemented:

1. **Detailed "About Us":** Move from generic disclaimer to a story-driven mission page.
2. **Contact Us Page:** Create `app/[locale]/(basic-layout)/contact/page.tsx` with a functional contact form or clear email address.
3. **Advanced Privacy Policy:** Update with CCPA/GDPR compliance and Google AdSense cookie disclosures.
4. **Author Bios:** Ensure each blog post links to a "Meet the Team" section to satisfy E-E-A-T.

---

## 4. Technical Requirements for Ingestion

To support this workflow, the `migrate-docs.ts` script should be cloned and adapted as `migrate-blog.ts` to:
1. Target the correct `postType`.
2. Handle featured images (`featuredImageUrl`).
3. Support tags for taxonomy optimization.
