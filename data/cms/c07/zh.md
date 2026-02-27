---
title: "SNAG：把屏幕片段快速转成可投喂 AI 的 Markdown"
description: "了解如何使用 SNAG 配合 OpenClaw 捕获屏幕区域并即时转换为 Markdown，实现更快的 AI 上下文交付。"
---

# C07 用户案例：SNAG - 把屏幕片段快速转成可投喂 AI 的 Markdown

## 案例概览

- **类别：** 开发工具 / 开发者工作流
- **适用对象：** 需要频繁将屏幕截图转换为文本用于 AI 对话的开发者
- **资料来源：**
  - [OpenClaw 文档：Showcase](https://docs.openclaw.ai/start/showcase)
  - [am-will/snag](https://github.com/am-will/snag)

## 背景

在高频使用屏幕的工作流中，开发者经常需要将 UI 元素、代码片段或图表复制到 LLM 对话中。手工转录速度慢且容易出错。

SNAG 提供了简化方案：

- 点击拖拽捕获任意屏幕区域
- AI 驱动的 Markdown 转换
- 自动复制到剪贴板 - 随时可粘贴

## 已验证功能

来自 SNAG README 和 OpenClaw Showcase：

1. **区域选择**：点击并拖拽捕获屏幕上任意区域
2. **多显示器支持**：支持所有连接的显示器
3. **智能转录**：处理文本、代码、图表、流程图和 UI 元素
4. **即时剪贴板**：结果自动复制，随时可粘贴
5. **多模型支持**：Google Gemini、OpenRouter 或 Z.AI (GLM-4.6V)
6. **跨平台**：Linux (X11/Wayland)、Windows、macOS

## 落地步骤

### 1）安装 SNAG

```bash
uv tool install git+https://github.com/am-will/snag.git
```

### 2）配置 API Key

```bash
snag --setup
```

这会打开交互式菜单，配置首选模型和 API Key。

### 3）捕获屏幕

```bash
snag
```

- 左键点击 + 拖拽选择区域
- 松开鼠标开始捕获和处理
- 右键或 Escape 取消

### 4）粘贴到 OpenClaw

Markdown 结果已在剪贴板中。直接粘贴到 OpenClaw 对话中即可用于调试、总结或代码审查。

## 为什么能提升开发者效率

- **速度**：截图到 Markdown 只需几秒，而非几分钟
- **准确度**：AI 转录能处理复杂布局、代码语法和图表
- **剪贴板优先**：无需保存文件 - 即时粘贴工作流
- **灵活性**：可根据需求选择不同的 AI 提供方

## 实战建议

- **macOS**：首次运行时需授权屏幕录制权限（系统设置 → 隐私与安全性 → 屏幕录制）
- **全局快捷键**：设置桌面环境快捷键（如 GNOME 上的 Super+Shift+S）实现即时调用
- **API Key**：存储在 `~/.config/snag/.env` - 兼容不支持 shell 环境变量的快捷键

## 已证实事实 vs 待验证点

### ✅ 来源可查

- SNAG 支持区域捕获和多显示器使用
- SNAG 支持 Gemini、OpenRouter 和 Z.AI
- SNAG 自动输出 Markdown 并复制到剪贴板
- OpenClaw Showcase 收录了 SNAG 社区项目

### ⚠️ 因人而异

- 实际节省时间因使用场景而异
- 不同模型对特定内容类型（代码 vs 图表）的质量有差异

## 参考链接

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [SNAG GitHub 仓库](https://github.com/am-will/snag)
