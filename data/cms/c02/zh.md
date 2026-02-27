---
title: "用 padel-cli + OpenClaw 自动化 Padel 球场订场流程"
description: "一个高频订场用户如何通过 padel-cli 与 OpenClaw 插件流，减少手工刷 Padel 场地并将订场流程标准化。"
---

# C02 用户案例：用 padel-cli + OpenClaw 自动化 Padel 球场订场流程

## 案例概览

- **类别：** 自动化 / 插件工作流
- **适用对象：** 需要高频查询并预订 Playtomic 场地的用户
- **资料来源：**
  - [OpenClaw 文档：Showcase](https://docs.openclaw.ai/start/showcase)
  - [joshp123/padel-cli](https://github.com/joshp123/padel-cli)

## 背景

一位经常打晚间时段的用户，希望减少重复手工刷场地。原本流程通常是：

- 打开应用
- 按地点/日期/时段查询
- 为固定时间段每天重复操作

该用户希望把流程变成“可脚本化、可复用、可接入 OpenClaw”的方式。

## 来源可证实能力

根据仓库与 Showcase 信息，padel-cli 提供了：

1. 场地可用性与搜索命令
2. 认证后的下单命令
3. 适合重复场馆的 alias 管理
4. 便于自动化链路接入的 `--json` 输出
5. 面向 nix-openclaw 的 `openclawPlugin` flake output

## 落地路径

### 1）验证 CLI 构建与基础查询

```bash
go build -o padel
padel clubs --near "Madrid"
padel search --location "Barcelona" --date 2025-01-05 --time 18:00-22:00
```

### 2）配置认证与下单链路

```bash
padel auth login --email you@example.com --password yourpass
padel auth status
padel book --venue myclub --date 2025-01-05 --time 10:30 --duration 90
```

### 3）用 venue alias 固化重复操作

```bash
padel venues add --id "<playtomic-id>" --alias myclub --name "My Club" --indoor --timezone "Europe/Madrid"
padel venues list
padel search --venues myclub --date 2025-01-05 --time 09:00-11:00
```

### 4）接入 OpenClaw 插件工作流

仓库明确说明 `openclawPlugin` flake output。对于 nix-openclaw 部署，插件包会加入 `PATH`，技能目录会在工作区中自动链接。

## 结果（基于可证实信息）

- 流程可从“人工点点点”转为脚本驱动命令。
- 搜索/可用性/下单可以拼装为可复用步骤。
- JSON 输出 + venue alias 有助于提升重复执行稳定性。

## 已证实事实 vs 待验证点

### ✅ 已证实（来源可查）

- padel-cli 包含 `search`、`availability`、`auth`、`book`、`venues` 等命令。
- padel-cli 支持 JSON 输出。
- padel-cli 文档说明了用于 nix-openclaw 的 `openclawPlugin` flake output。
- OpenClaw Showcase 存在该项目的 "Padel Court Booking" 条目。

### ⚠️ 待验证（需用户访谈/埋点）

- 不同用户每周具体节省时长
- 在不同城市/场馆下订成功率提升幅度
- 高峰时段长期抢场成功率变化

## 实战建议

- 凭证和配置建议放在受保护本地路径（`~/.config/padel`）。
- 自动化前先校验时区与场馆 alias 映射。
- 对关键下单动作保留确认步骤，避免误操作。

## 参考链接

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)
