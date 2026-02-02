# LearnClawdBot.org 🤖📚

[🇺🇸 English](./README.md) | [🇯🇵 日本語](./README-ja.md) | [🇰🇷 한국어](./README-ko.md)

**最全面的 [OpenClaw](https://github.com/openclaw/openclaw) 多语言文档站** — 你的开源 AI 助手框架。

🌐 **在线访问：** [https://learnclawdbot.org](https://learnclawdbot.org)

---

## ✨ 这是什么？

LearnClawdBot.org 是一个**非官方、社区驱动**的 OpenClaw（原 Moltbot/Clawdbot）文档和教程网站。我们提供：

- 📖 **264+ 文档页面**，覆盖 OpenClaw 的方方面面
- 🌍 **4 种语言** — 英文、中文、日文、韩文
- 🔧 **手把手教程**，从安装配置到高级用法
- 💡 **实战示例**和最佳实践
- 📝 **博客文章**，包含技巧、集成方案和使用案例

## 🌍 语言覆盖

| 语言 | 文档数 | 状态 |
|------|--------|------|
| 🇺🇸 English | 264 页 | ✅ 完成 |
| 🇨🇳 中文 | 264 页 | ✅ 完成 |
| 🇯🇵 日本語 | 264 页 | ✅ 完成 |
| 🇰🇷 한국어 | 260 页 | 🔄 98% 完成 |

## 📚 文档结构

```
docs/
├── en/          # 英文（源文件）
├── zh/          # 中文
├── ja/          # 日文
├── ko/          # 韩文
│
├── channels/    # Telegram、Discord、WhatsApp、Signal、Slack、LINE...
├── cli/         # CLI 命令参考（41 个命令）
├── concepts/    # 架构、Agent、Session、模型...
├── gateway/     # 配置、安全、远程访问...
├── install/     # npm、Docker、Nix、Bun...
├── nodes/       # 移动节点、摄像头、音频、定位...
├── platforms/   # macOS、Linux、Windows、树莓派、云平台...
├── plugins/     # 语音通话、Agent 工具、Manifest...
├── providers/   # Anthropic、OpenAI、Ollama、DeepSeek、Gemini...
├── start/       # 快速开始指南
├── tools/       # 浏览器自动化、代码执行、技能、子 Agent...
└── web/         # 仪表盘、网页聊天、控制 UI...
```

## 🛠️ 技术栈

- **框架：** [Next.js](https://nextjs.org/)（App Router）
- **文档引擎：** [Fumadocs](https://fumadocs.vercel.app/)
- **样式：** Tailwind CSS
- **国际化：** next-intl（4 种语言）
- **部署：** Vercel
- **内容：** 基于 MDX

## 🚀 快速开始

### 前置条件

- Node.js 18+
- pnpm（推荐）或 npm

### 安装

```bash
git clone https://github.com/kaixinbaba/learnclawdbot.git
cd learnclawdbot
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看网站。

### 构建

```bash
pnpm build
```

## 🤝 参与贡献

欢迎贡献！你可以通过以下方式参与：

- **🌍 改进翻译** — 修正翻译质量或补充缺失页面
- **📝 更新内容** — 让文档与最新版 OpenClaw 保持同步
- **🐛 修复问题** — 报告或修复网站问题
- **✨ 撰写教程** — 写关于 OpenClaw 使用场景的博客文章

### 翻译指南

1. `docs/en/` 中的英文文档是源文件
2. 翻译文档放在 `docs/{locale}/` 中，保持相同的文件结构
3. MDX 结构保持一致 — 只翻译文本内容
4. 代码块、行内代码和技术术语保留英文

## 📊 OpenClaw 覆盖内容

- **19 个渠道集成** — Telegram、Discord、WhatsApp、Signal、Slack、LINE、Matrix、Twitch 等
- **19 个 AI 提供商** — Anthropic、OpenAI、Ollama、DeepSeek、Gemini、Qwen 等
- **14 个平台指南** — macOS、Linux、Windows、Docker、树莓派、云平台
- **22 个工具参考** — 浏览器自动化、代码执行、技能、子 Agent
- **30 个概念解读** — Agent 架构、Session、模型故障转移、上下文管理

## 📄 许可证

本项目开源。文档内容仅供教育目的使用。

## 🔗 相关链接

- 🌐 **网站：** [learnclawdbot.org](https://learnclawdbot.org)
- 🤖 **OpenClaw：** [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- 📖 **官方文档：** [docs.openclaw.ai](https://docs.openclaw.ai)
- 💬 **社区：** [OpenClaw Discord](https://discord.com/invite/clawd)

---

*由 OpenClaw 社区用 ❤️ 构建*
