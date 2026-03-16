import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const AUTHOR_EMAIL = "452914639@qq.com";
const POST_TYPE = "glossary";
const LOCALES = ["en", "zh", "ja", "ko", "ru"] as const;
type SupportedLocale = (typeof LOCALES)[number];

const GLOSSARY_ENTRIES = [
  {
    slug: "openclaw",
    en: {
      title: "OpenClaw",
      description: "The core open-source framework for building and deploying AI agents.",
      content: "OpenClaw is a versatile, open-source framework designed to simplify the creation, management, and deployment of AI agents. It provides a standard for 'skills' (tools) and allows agents to operate across various platforms like WhatsApp, Telegram, and the web."
    },
    zh: {
      title: "OpenClaw",
      description: "用于构建和部署 AI 代理的核心开源框架。",
      content: "OpenClaw 是一个通用的开源框架，旨在简化 AI 代理的创建、管理和部署。它为“技能”（工具）提供了标准，并允许代理在 WhatsApp、Telegram 和 Web 等各种平台上运行。"
    }
  },
  {
    slug: "ai-agent",
    en: {
      title: "AI Agent",
      description: "An autonomous system powered by LLMs that can use tools to perform tasks.",
      content: "An AI agent is an autonomous software system that uses Large Language Models (LLMs) as its reasoning engine. Unlike a simple chatbot, an agent can observe its environment, use tools (skills), and execute complex multi-step plans to achieve a specific goal."
    },
    zh: {
      title: "AI 代理 (AI Agent)",
      description: "由 LLM 驱动的自主系统，可以使用工具执行任务。",
      content: "AI 代理是一种自主软件系统，使用大语言模型 (LLM) 作为其推理引擎。与简单的聊天机器人不同，代理可以观察其环境，使用工具（技能），并执行复杂的多步骤计划以实现特定目标。"
    }
  },
  {
    slug: "skill-manifest",
    en: {
      title: "Skill Manifest",
      description: "A configuration file that defines an AI agent's capability.",
      content: "A Skill Manifest is a structured file (usually JSON or YAML) that tells an AI agent how to use a specific tool. It defines the input parameters, output format, and the API or function that the agent should call."
    },
    zh: {
      title: "技能清单 (Skill Manifest)",
      description: "定义 AI 代理能力的配置文件。",
      content: "技能清单是一个结构化文件（通常为 JSON 或 YAML），它告诉 AI 代理如何使用特定工具。它定义了输入参数、输出格式以及代理应调用的 API 或函数。"
    }
  },
  {
    slug: "context-window",
    en: {
      title: "Context Window",
      description: "The limited amount of text an AI model can process in one turn.",
      content: "The context window refers to the maximum number of tokens (words or parts of words) an LLM can 'see' and process at one time. Managing the context window is crucial for building effective AI agents that don't 'forget' important details during long conversations."
    },
    zh: {
      title: "上下文窗口 (Context Window)",
      description: "AI 模型在一次轮次中可以处理的有限文本量。",
      content: "上下文窗口是指 LLM 一次可以“看到”和处理的最大 Token 数量（单词或单词的一部分）。管理上下文窗口对于构建有效的 AI 代理至关重要，这些代理在长时间对话中不会“忘记”重要细节。"
    }
  },
  {
    slug: "rag-retrieval-augmented-generation",
    en: {
      title: "RAG (Retrieval-Augmented Generation)",
      description: "A technique that gives AI agents access to external, real-time data.",
      content: "Retrieval-Augmented Generation (RAG) is a technique used to provide LLMs with specific, up-to-date data that wasn't included in their original training. By searching a knowledge base before generating a response, the AI agent can provide more accurate and context-aware answers."
    },
    zh: {
      title: "RAG (检索增强生成)",
      description: "一种让 AI 代理访问外部实时数据的技术。",
      content: "检索增强生成 (RAG) 是一种用于为 LLM 提供其原始训练中未包含的特定、最新数据的技术。通过在生成响应之前搜索知识库，AI 代理可以提供更准确且具有上下文意识的答案。"
    }
  }
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function resolveAuthorId(): Promise<string> {
  const explicit = await sql`
    SELECT id FROM "user" WHERE email = ${AUTHOR_EMAIL} LIMIT 1;
  `;
  if (explicit.length > 0) return explicit[0].id;

  const fallback = await sql`
    SELECT id FROM "user" ORDER BY created_at ASC LIMIT 1;
  `;
  if (fallback.length === 0) throw new Error("No user record found.");
  return fallback[0].id;
}

async function main() {
  try {
    const authorId = await resolveAuthorId();
    let inserted = 0;
    let updated = 0;

    for (const entry of GLOSSARY_ENTRIES) {
      for (const locale of LOCALES) {
        // Fallback to English if locale not provided
        const content = (entry as any)[locale] || entry.en;
        
        const existing = await sql`
          SELECT id FROM posts 
          WHERE slug = ${entry.slug} AND language = ${locale} AND post_type = ${POST_TYPE}
          LIMIT 1;
        `;

        await sql`
          INSERT INTO posts (
            language, post_type, author_id, title, slug, content, description,
            status, visibility, published_at
          )
          VALUES (
            ${locale}, ${POST_TYPE}, ${authorId}, ${content.title}, ${entry.slug}, 
            ${content.content}, ${content.description}, 'published', 'public', NOW()
          )
          ON CONFLICT (slug, language, post_type)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            description = EXCLUDED.description,
            updated_at = NOW();
        `;

        if (existing.length > 0) updated++;
        else inserted++;
      }
    }

    console.log(`🎉 Glossary seeded: ${inserted} inserted, ${updated} updated.`);
  } catch (error) {
    console.error("Seed glossary failed:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
