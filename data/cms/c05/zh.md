---
title: "C05 用户案例：用 linear-cli + OpenClaw 串起 Linear 议题到 PR 流程"
description: "基于公开资料，构建从终端执行 Linear 议题操作到 PR 衔接的可复用工作流，并与 OpenClaw 协同。"
---

# C05 用户案例：用 linear-cli + OpenClaw 串起 Linear 议题到 PR 流程

## 概览

- **类别：** 自动化 / 开发者工作流
- **适用对象：** 使用 Linear 且希望通过命令行稳定执行并结合 AI 协同的团队
- **资料来源：**
  - [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
  - [Finesssee/linear-cli](https://github.com/Finesssee/linear-cli)
  - [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)

## 背景

在很多团队中，议题处理经常分散在浏览器页面、本地终端和聊天工具之间，导致上下文切换频繁，重复动作难以沉淀。

本案例聚焦一条有文档支撑的路径：

1. 用 `linear-cli` 执行议题与 git 操作；
2. 保留结构化输出，便于自动化；
3. 将上下文交给 OpenClaw 继续推进后续决策。

## 来源可证实能力

结合项目 README、examples 文档和 OpenClaw Showcase：

1. `linear-cli` 覆盖了较完整的 Linear 命令集合（issues、projects、labels、teams、cycles、comments 等）。
2. 认证方式支持浏览器 OAuth 与 API key 两条路径。
3. 议题工作流命令覆盖 start/stop/close 以及指派相关操作。
4. Git 集成提供议题关联分支与 PR 创建（`linear-cli g checkout`、`linear-cli g pr`）。
5. 文档明确支持 JSON/NDJSON 输出，便于脚本与 agent 场景。
6. OpenClaw Showcase 已收录 Linear CLI 作为社区项目。

## 落地路径

### 1）安装并验证 CLI

```bash
cargo install linear-cli
linear-cli --help
```

### 2）配置认证

```bash
linear-cli auth oauth
# 或
linear-cli config set-key lin_api_xxx
```

### 3）在终端执行议题工作流

```bash
linear-cli i list --mine --output json --compact
linear-cli i start LIN-123 --checkout
linear-cli i comment LIN-123 -b "Work started from CLI workflow"
```

### 4）完成分支/PR 衔接并交由 OpenClaw 协同

```bash
linear-cli g pr LIN-123 --draft
```

将命令输出带入 OpenClaw 对话，继续执行评审清单、合并准备与后续安排。

## 结果（基于可证实信息）

- 议题到 PR 的主流程可在单一 CLI 界面中重复执行。
- 结构化输出有利于后续自动化与 AI 上下文传递。
- 对常规操作可减少手工 UI 跳转依赖。

## 已证实事实 vs 待验证点

### ✅ 已证实（来源可查）

- Linear CLI 含议题、git 及更广泛的工作区命令能力。
- OAuth/API key 认证流程有文档说明。
- JSON/NDJSON 输出能力有文档说明。
- Showcase 页面收录了 Linear CLI。

### ⚠️ 待验证（需团队埋点/访谈）

- 单个议题平均流转时长变化
- 采用 CLI 流程后的评审等待时长变化
- 多仓库场景下的长期吞吐变化

## 实战建议

- 在团队规范中统一议题标识（如 `LIN-123`）。
- 与 AI 工作流联动时优先使用结构化输出。
- 在不同环境中显式指定认证方式，减少工作区混淆。

## 参考链接

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [linear-cli 仓库](https://github.com/Finesssee/linear-cli)
- [linear-cli examples](https://github.com/Finesssee/linear-cli/blob/master/docs/examples.md?raw=1)
