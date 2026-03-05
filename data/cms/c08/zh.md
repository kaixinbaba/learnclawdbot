---
title: Clawdia Phone Bridge - 使用 Vapi 和 OpenClaw 构建你的语音 AI 助手
description: 了解如何通过 HTTP 桥接将 Vapi 语音助手连接到 OpenClaw，构建实时语音 AI 助手，实现通过电话与 AI 代理通话。
slug: /clawdia-phone-bridge
tags: voice, vapi, bridge, phone, ai-assistant
publishedAt: 2026-03-05
status: published
visibility: public
featuredImageUrl: /images/features/clawdia-phone-bridge.webp
---

# Clawdia Phone Bridge - 使用 Vapi 和 OpenClaw 构建你的语音 AI 助手

想过直接给 AI 助手打电话吗？通过 **Clawdia Phone Bridge**，你可以做到。这个项目创建了 Vapi 语音 AI 与 OpenClaw 之间的实时语音桥接，让你可以进行近乎实时的电话语音对话。

## 什么是 Clawdia Phone Bridge？

[Clawdia Phone Bridge](https://github.com/alejandroOPI/clawdia-bridge) 是一个 HTTP 桥接器，连接 Vapi（语音助手平台）和 OpenClaw。它允许你：

- 给 AI 助手打电话
- 实时获取语音回复
- 通过语音访问所有 OpenClaw 技能（日历、邮件、天气等）

## 工作原理

架构设计非常简洁：

1. **你** 拨打打电话
2. **Vapi** 捕获你的声音并发送到桥接器
3. **Clawdia Bridge** 通过 WebSocket 将请求转发给 OpenClaw
4. **OpenClaw** 使用 AI 代理处理请求
5. **回复** 通过桥接器返回给 Vapi
6. **Vapi** 将回复语音读给你

```
你（电话）
    ↓
Clawdia（Vapi 语音 AI）
    ↓ POST /ask（工具调用）
Clawdia Bridge
    ↓ WebSocket 到 Gateway
Clawdius（处理请求）
    ↓ 返回响应
Clawdia Bridge
    ↓ 返回给 Vapi
Clawdia
    ↓ 语音回复
你
```

## 快速开始

### 前置条件

- 已安装 Node.js
- Vapi 账户
- OpenClaw Gateway 运行中

### 安装

```bash
# 克隆仓库
git clone https://github.com/alejandroOPI/clawdia-bridge.git
cd clawdia-bridge

# 安装依赖
npm install

# 运行桥接器
npm start
```

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| BRIDGE_PORT | 3847 | 监听端口 |
| GATEWAY_URL | ws://127.0.0.1:18789 | OpenClaw Gateway WebSocket URL |

### Vapi 配置

1. **创建助手**：在 Vapi 控制台，创建名为 "Clawdia" 的助手
2. **配置语音**：选择女声（如 Vapi 的 Lily）
3. **添加工具**：添加 `ask_clawdius` 函数工具
4. **分配电话号码**：连接 Vapi 电话号码

### 暴露到互联网

生产环境使用：

```bash
# 使用 Tailscale Funnel（推荐）
npm start
tailscale funnel 3847

# 或使用 ngrok
npm start
ngrok http 3844
```

## API 端点

### POST /ask

Vapi 调用来与 OpenClaw 通信的主要端点：

```json
{
  "question": "今天天气怎么样？"
}
```

响应：

```json
{
  "answer": "当前天气晴朗，气温 22°C。"
}
```

### GET /health

健康检查端点：

```json
{
  "status": "ok",
  "mode": "gateway-ws"
}
```

## 为什么这很重要

这个桥接器开启了无限可能：

- **语音优先工作流**：无需动手与 AI 交互
- **电话 AI 代理**：创建可通过普通电话调用的 AI 助手
- **无障碍访问**：让技术小白也能使用 AI 助手
- **商业应用**：客服、预约查询、信息检索

## 使用场景

- **个人 AI 助手**：给 AI 打电话查日历、天气或发邮件
- **商务热线**：通过电话提供 AI 驱动的客户支持
- **老年辅助**：简单的语音界面访问 AI
- **解放双手**：开车或做饭时完成任务

## 总结

Clawdia Phone Bridge 展示了将语音 AI 与 OpenClaw 代理能力相结合的强大力量。通过桥接 Vapi 和 OpenClaw，你可以创建利用所有 OpenClaw 技能和集成的复杂语音 AI 助手。

准备好构建你的语音 AI 了吗？查看 [GitHub 仓库](https://github.com/alejandroOPI/clawdia-bridge) 获取完整文档。
