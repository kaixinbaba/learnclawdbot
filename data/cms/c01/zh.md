---
title: "使用 nix-openclaw 实现 OpenClaw 声明式部署"
description: "一个小型运维团队如何通过 nix-openclaw 与 Home Manager，在 macOS / Linux 上实现可复现、可回滚的 OpenClaw 部署。"
---

# C01 用户案例：使用 nix-openclaw 实现 OpenClaw 声明式部署

## 案例概览

- **类别：** 部署 / 基础设施
- **适用对象：** 需要长期维护 OpenClaw 实例的工程团队
- **资料来源：**
  - [OpenClaw 文档：Nix 安装](https://docs.openclaw.ai/install/nix)
  - [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)

## 背景

一个 3 人平台团队同时维护 Mac mini 与 Linux VPS 上的 OpenClaw。过去采用“命令式手工安装 + 本地临时修补”的方式，问题逐步暴露：

- 不同机器上的工具版本不一致
- 配置修改散落在本地，难追溯
- 升级失败后回滚成本高

团队希望将部署改造成“声明式 + 可审计 + 可回滚”的模式。

## 迁移前痛点

1. **环境漂移**：开发机、线上机状态逐渐偏离
2. **可复现性差**：新机器接入耗时、步骤不稳定
3. **升级风险高**：缺少标准化回滚通道
4. **边界不清晰**：固定配置与运行时状态混在一起

## 选择 nix-openclaw 的原因

基于官方文档与仓库信息，nix-openclaw 提供了：

- 面向 OpenClaw 的 **Home Manager 模块**
- 依赖版本可锁定的 Nix 构建链路
- 服务托管：macOS 用 **launchd**，Linux 用 **systemd --user**
- OpenClaw **Nix mode**（`OPENCLAW_NIX_MODE=1`）用于关闭自修改流程
- Home Manager generations 带来的快速回滚能力

## 落地路径

### 1）从官方模板初始化 flake

团队基于 `templates/agent-first/flake.nix` 填写用户、系统架构、渠道配置等占位信息。

### 2）明确“声明式配置”与“运行时状态”的边界

他们将：

- 声明式配置放入 flake 与 `programs.openclaw.config`
- 文档文件（`AGENTS.md`、`SOUL.md`、`TOOLS.md`）纳入受管目录
- 会话/缓存等运行态继续放在 `~/.openclaw`

这与 Golden Paths 中“pinned config vs runtime state”原则一致。

### 3）通过文件路径管理敏感信息

Telegram Token、模型 API Key 等通过文件路径注入，避免把密钥直接写入配置。

### 4）执行与验证

```bash
home-manager switch --flake .#<user>
```

验证重点：

- macOS：`launchctl print gui/$UID/com.steipete.openclaw.gateway`
- Linux：`systemctl --user status openclaw-gateway`

## 结果

迁移完成后，部署流程从“人工经验”变成“配置即基础设施”：

- 新机器接入路径统一，复现更稳定
- 依赖锁定后，升级可控性明显提升
- 回滚路径清晰（`home-manager switch --rollback`）
- 团队协作从“口头同步”转向“配置变更评审”

## 实战建议

- 涉及屏幕/辅助功能时，macOS TCC 权限仍需一次性人工授权。
- 声明式环境建议保持 Nix mode 开启，减少运行时自修改。
- 插件来源建议固定版本，并把部署变更纳入代码评审流程。

## 参考链接

- [OpenClaw Nix 安装说明](https://docs.openclaw.ai/install/nix)
- [nix-openclaw README 与模块选项](https://github.com/openclaw/nix-openclaw)
- [Golden Paths 指南](https://github.com/openclaw/nix-openclaw/blob/main/docs/golden-paths.md)
