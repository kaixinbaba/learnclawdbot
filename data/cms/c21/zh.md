---
title: "优化 OpenClaw 长会话上下文管理"
description: "掌握 OpenClaw 的上下文窗口、记忆策略与会话管理。学习如何在大型代码库、长文档和多会话项目中高效工作，不再受上下文限制的困扰。"
publishedAt: 2026-03-22
status: published
visibility: public
---

# 优化 OpenClaw 长会话上下文管理

上下文窗口是使用 AI 助手时最重要的资源约束。模型对当前任务所掌握的一切——对话历史、你分享的文件、你提供的背景信息——都必须容纳在这个窗口之中。一旦它被填满，较旧的信息就会被丢弃，模型开始丢失对对话的追踪。

大多数人第一次遭遇这个限制，都是在处理大型代码库任务时：他们分享了一堆文件，要求进行复杂的重构，然后在某个中途，模型忘记了他们在开始时建立的约束条件。质量下降，对话不得不重新开始。

理解 OpenClaw 如何管理上下文，并学会与之配合而非抗拒，能将令人沮丧的上下文限制问题转化为可解决的工程问题。

## OpenClaw 如何处理上下文

OpenClaw 的上下文由几个占用 tokens 的部分组成：

1. **系统提示词** — 定义模型行为方式的指令（由 OpenClaw 设置，可通过配置扩展）
2. **对话历史** — 当前会话中的所有消息
3. **已加载的文件** — 通过 `--files` 或文件引用方式分享的任何文件
4. **工具调用结果** — MCP 服务器和 OpenClaw 内置工具的响应
5. **注入的上下文** — 通过 `--context` 显式加载的背景信息

所有内容的总量必须适配模型的上下文窗口。对于云端模型：
- Claude 3.5 Sonnet：200K tokens
- GPT-4o：128K tokens
- Gemini 1.5 Pro：1M tokens（但费用较高）

对于本地模型：
- 大多数 7B-13B 模型：8K-32K tokens
- Llama 3.1：最高 128K
- Mistral：32K-64K，取决于版本

Token 数量粗略估算：1 token ≈ 4 个英文字符。一个典型的 200 行代码文件大约是 2,000-4,000 tokens。

## 查看当前上下文使用量

OpenClaw 通过多种方式显示 token 使用情况：

```bash
# 显示当前会话统计
openclaw status

# 输出：
# Session: dev-session-001
# Messages: 23
# Tokens used: 47,234 / 200,000 (23.6%)
# Model: claude-3-5-sonnet
# Active files: 4 (12,400 tokens)
```

在对话过程中，OpenClaw 界面中的上下文进度条会实时显示使用量。当达到 80% 时，开始考虑上下文管理策略。

## 策略一：精准文件加载

最常见的错误是在只需要部分内容时加载整个文件。一个 2,000 行的文件要耗费 20,000+ tokens。如果你只需要了解导出内容，可能只需要 200 tokens。

**加载特定部分：**

```bash
# 不要这样加载整个文件
openclaw chat --files src/api/server.ts "explain the auth middleware"

# 更好的做法：具体描述你需要什么
openclaw chat "Look at src/api/server.ts and explain only the auth middleware section"
```

当你让 OpenClaw 查看文件而不是通过 `--files` 加载时，它会读取文件并提取所需内容。这通常在 token 使用上更加高效。

**使用 glob 模式只加载相关文件：**

```bash
# 避免：加载所有内容
openclaw chat --files "src/**/*.ts" "fix the authentication bug"

# 更好：只加载与认证相关的文件
openclaw chat --files "src/auth/*.ts,src/middleware/auth*.ts" "fix the authentication bug"
```

## 策略二：总结后再继续

长时间的对话会快速积累 token 债务。历史记录中的每条消息都消耗 tokens。在一个富有成效的会话解决了某个问题之后，在提出下一个问题之前先总结你学到的内容：

```
你："在继续之前，让我们总结一下目前已确定的内容：
- 认证 bug 在 jwt.ts 第 47 行
- 修复方法是在签名验证前先检查 token 是否过期
- 测试文件需要用新行为更新

现在，带着这些上下文，让我们来处理 session.ts 中相关的会话过期问题"
```

通过显式总结，你为模型提供了一个紧凑的参考，它能替代导致这些结论的冗长对话。模型可以基于总结工作，而不需要重新阅读所有先前的消息。

## 策略三：为多日项目使用命名会话

OpenClaw 的会话默认是临时的。当你关闭终端时，对话上下文就消失了。对于跨越多天的项目，请使用命名会话：

```bash
# 开始一个命名会话
openclaw chat --session my-refactor-project

# 之后恢复它
openclaw chat --session my-refactor-project
```

命名会话会将对话历史持久化到磁盘。但持久化并不能解决 token 预算问题——一个已有一周历史的对话会有庞大的历史记录。解决方案是将会话用于专注的工作阶段，然后为下一阶段开始新的会话。

**多周项目的会话工作流：**

```
第一周：--session refactor-phase-1
  目标：了解代码库，识别问题区域
  结束：总结发现，关闭会话

第二周：--session refactor-phase-2
  开始：将第一周的总结作为上下文加载
  目标：实施已识别问题的修复方案
  结束：总结所做的更改，关闭会话

第三周：--session refactor-phase-3
  开始：加载第二周的总结
  目标：测试和边缘情况处理
```

## 策略四：使用上下文文件作为背景

对于在许多对话中都有用的信息——项目文档、编码规范、API 模式——使用 OpenClaw 的上下文加载功能：

```bash
# 创建包含稳定背景信息的上下文文件
cat > .openclaw-context.md << 'EOF'
# Project Context

This is a Node.js API for a SaaS billing system.
Key constraints:
- Never modify the Stripe webhook handlers without QA sign-off
- All amounts are in cents (no floats for money)
- The legacy V1 API must remain backward compatible
- Use the internal audit logger for all financial operations

Database: PostgreSQL 16
ORM: Drizzle
Auth: JWT with 24h expiry, refresh tokens stored in Redis
EOF

# 在每次会话开始时加载它
openclaw chat --context .openclaw-context.md "Let's work on the invoice generation feature"
```

这比在每次对话中重新解释上下文更加高效。上下文文件会消耗 tokens，但它很紧凑，且你能精确控制其内容。

## 策略五："工作区"模式

对于大型代码库的工作，定义一个工作区：一套精心挑选的最相关文件集合，能够舒适地适配上下文预算。

```bash
# 创建工作区配置
cat > .openclaw-workspace.yaml << 'EOF'
name: auth-system
files:
  - src/auth/jwt.ts
  - src/auth/session.ts
  - src/middleware/auth.ts
  - src/models/user.ts
  - tests/auth/*.test.ts
context:
  - docs/auth-architecture.md
EOF

# 在工作区中工作
openclaw chat --workspace .openclaw-workspace.yaml "audit the session handling for security issues"
```

工作区在各会话之间保持一致。当你需要扩大范围时，更新工作区文件即可。

## 策略六：渐进式精炼

对于长文档或复杂任务，采用渐进式工作，而非尝试在一次处理中完成所有事情：

**总结 → 提纲 → 草稿 → 精炼**

```
第一轮："阅读这 5 个源文件，给我每个文件工作原理的一段话总结"
第二轮："根据这些总结，概述重构认证流程的方案"
第三轮："现在让我们实现你方案的第一步——只做 JWT 验证的更改"
第四轮："让我们回顾我们的更改并测试边缘情况"
```

每一轮都建立在前一轮紧凑输出的基础上。到了实现阶段，你在上下文中携带的不是完整的文件内容，而只是总结。

## 在自动化中监控上下文

对于通过脚本调用 OpenClaw API 的情况，以编程方式监控上下文使用量：

```typescript
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  body: JSON.stringify({
    model: "claude-3-5-sonnet",
    messages: conversationHistory,
  }),
});

const data = await response.json();

// 检查响应中的 token 使用量
const usage = data.usage;
console.log(`Tokens used: ${usage.prompt_tokens} + ${usage.completion_tokens}`);

// 如果接近限制，触发总结
if (usage.prompt_tokens > 150000) {
  await summarizeAndCompressHistory(conversationHistory);
}
```

## 处理上下文溢出

当上下文尽管采取了最佳措施仍然填满时：

**优雅的恢复模式：**

1. 让模型总结当前状态："在我们继续之前，请用要点形式总结：(1) 我们试图完成什么，(2) 我们已经确定了什么，(3) 下一步是什么"
2. 开启新会话
3. 将总结作为开场上下文加载

```bash
# 从旧会话中导出总结
openclaw chat --session old-session "summarize our current state for handoff to a new session" > session-handoff.txt

# 用交接内容开始新会话
openclaw chat --context session-handoff.txt "Continue from the session summary above..."
```

## 不同模型的上下文注意事项

不同模型的 token 计算特征各有不同：

**Claude 模型**使用 Anthropic 的分词器。代码相对高效——Claude 能很好地处理代码语法，因此代码文件不会像某些其他模型那样膨胀那么多。

**GPT 模型**使用 tiktoken。对英文文本的效率相似，对语法不寻常的代码略低效。

**本地模型**各有差异。基于 Llama 的模型使用 SentencePiece 分词器。与某些拥有专用分词器的云端模型相比，亚洲语言的 token 消耗可能更高。

对于多语言工作，请注意中文和日文文本在某些分词器下通常比等效的英文文本多消耗 2-3 倍的 tokens。即使最终输出将使用其他语言，也建议尽量用英文撰写上下文文件和背景信息。

## 常见问题

**OpenClaw 删除了我的对话历史——发生了什么？**

未命名的会话默认不会持久化到磁盘。使用 `--session session-name` 来保存对话。在 `~/.openclaw/sessions/` 中查找已保存的会话。

**如何知道我即将达到上下文限制？**

OpenClaw 在界面中显示进度条。对于 API 使用，监控响应中的 `usage.prompt_tokens` 字段。设置一个警告阈值（例如，模型上下文窗口的 80%），并在达到限制之前触发总结。

**重置对话会清除上下文吗？**

是的，在聊天中使用 `openclaw clear` 或 `/clear` 会清除对话历史。通过 `--files` 加载的文件和通过 `--context` 加载的上下文也会被释放。下一条消息将从头开始。

**我可以为本地模型增加上下文窗口吗？**

Ollama 的上下文大小在模型加载时设置。你可以增加它，但存在质量与性能的权衡。超出模型训练的上下文长度（不是 VRAM 限制）之后，质量会下降：

```bash
# 为 Ollama 设置上下文大小
OLLAMA_NUM_CTX=32768 ollama run mistral:7b
```

只有在测试确认质量仍然可接受的情况下，才考虑超出模型默认值。

上下文管理是一种会不断积累收益的技能。一旦你内化了 tokens 的工作原理以及保护它们的策略，在大型代码库上的工作就会变得大幅度高效。那些限制不再像是无法逾越的高墙，而开始像是你可以绕过的工程约束。
