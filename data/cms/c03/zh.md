---
title: "C03 用户案例：用 SNAG 把屏幕片段快速转成可投喂 OpenClaw 的 Markdown"
description: "通过 SNAG + OpenClaw 工作流，把屏幕区域快速转换为 markdown，上下文交付更快、更稳定。"
---

# C03 用户案例：用 SNAG 把屏幕片段快速转成可投喂 OpenClaw 的 Markdown

## 案例概览

- **案例编号：** C03
- **优先级：** P1
- **类别：** 自动化 / 开发者工作流
- **适用对象：** 需要频繁把屏幕中的代码/UI片段投喂给 AI 对话的用户
- **资料来源：**
  - [OpenClaw 文档：Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## 背景

在高频截图与调试场景下，用户经常需要把屏幕上的 UI 局部、代码片段或流程图转成可直接用于 LLM 的文本。纯手工转写速度慢且容易漏信息。

本案例目标是把这条路径固化为可复用流程：

- 选区截图，
- 自动转 markdown，
- 粘贴到 OpenClaw 对话上下文。

## 来源可证实能力

根据 SNAG README 与 OpenClaw Showcase：

1. SNAG 是 screenshot-to-text CLI 工具。
2. 支持区域选择与多显示器捕获。
3. 可处理文本/代码/图表/UI，并把 markdown 结果写入剪贴板。
4. 支持多模型提供方（Google Gemini、OpenRouter、Z.AI）。
5. OpenClaw Showcase 收录了 SNAG（“Screenshot-to-Markdown”）。

## 落地路径

### 1）安装 SNAG

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2）配置模型与 API Key

```bash
snag --setup
```

按你的环境设置 provider、model 与 API key。

### 3）执行截图转写

```bash
snag
```

选定屏幕区域后，SNAG 会将 markdown 输出直接写入剪贴板。

### 4）接入 OpenClaw 对话流程

将剪贴板内容粘贴到 OpenClaw，会话即可继续做调试、总结或代码审查。

## 结果（基于可证实信息）

- “截图到文本”由手工改写变为命令化步骤。
- 剪贴板直出 markdown，减少上下文拼装摩擦。
- 多提供方支持，便于贴合现有 AI 技术栈。

## 已证实事实 vs 待验证点

### ✅ 已证实（来源可查）

- SNAG 支持区域捕获和多显示器使用。
- SNAG 支持 Gemini / OpenRouter / Z.AI。
- SNAG 输出 markdown 可用文本并写入剪贴板。
- OpenClaw Showcase 展示了 SNAG 社区项目。

### ⚠️ 待验证（需用户访谈/埋点）

- 单次截图到可用上下文的平均耗时下降幅度
- 与手工转写相比的错误率变化
- 对长期调试效率的量化提升

## 实战建议

- macOS 首次运行需授权屏幕录制权限。
- 若走全局快捷键，需确保 `snag` 在 PATH 中可调用。
- API Key 建议按 SNAG 文档放在本地配置目录（`~/.config/snag/`）。

## 参考链接

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG README](https://github.com/am-will/snag)
