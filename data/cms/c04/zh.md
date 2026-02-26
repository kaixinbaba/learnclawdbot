---
title: "C04 用户案例：用 bambu-cli + OpenClaw 管理 BambuLab 3D 打印流程"
description: "基于公开文档，使用 bambu-cli 与 OpenClaw 建立可复用的 BambuLab 打印控制工作流。"
---

# C04 用户案例：用 bambu-cli + OpenClaw 管理 BambuLab 3D 打印流程

## 案例概览

- **类别：** 自动化 / 硬件工作流
- **适用对象：** 希望用命令行稳定管理 BambuLab 打印任务的用户
- **资料来源：**
  - [OpenClaw 文档：Showcase](https://docs.openclaw.ai/start/showcase)
  - [tobiasbischoff/bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
  - [bambu-cli README（raw）](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## 背景

如果打印任务完全依赖 GUI，像“查状态、启动打印、切换配置”这类重复操作容易碎片化，难以复用。

本案例聚焦一条有文档支撑的命令化路径：

- 一次配置，
- 重复执行操作命令，
- 再把输出接入 OpenClaw 对话做后续处理。

## 来源可证实能力

根据 bambu-cli README 与 OpenClaw Showcase：

1. `bambu-cli` 是一个通过 MQTT/FTPS/摄像头通道控制 BambuLab 打印机的 CLI。
2. 文档明确提供安装与快速上手命令（`brew install`、`config set`、`status`、`print start`）。
3. 文档定义了配置优先级（flags > env > project config > user config）。
4. 文档列出了所需网络端口（8883 MQTT、990 FTPS、6000 camera）。
5. OpenClaw Showcase 将 “Bambu 3D Printer Control” 收录为社区项目，定位为打印控制/排障工作流。

## 落地路径

### 1）安装 bambu-cli

```bash
brew install tobiasbischoff/tap/bambu-cli
```

### 2）用文件方式配置打印机 profile 与 access code

```bash
mkdir -p ~/.config/bambu
printf "%s" "YOUR_ACCESS_CODE" > ~/.config/bambu/lab.code
chmod 600 ~/.config/bambu/lab.code

bambu-cli config set --printer lab \
  --ip 192.168.1.200 \
  --serial AC12309BH109 \
  --access-code-file ~/.config/bambu/lab.code \
  --default
```

### 3）执行核心操作命令

```bash
bambu-cli status
bambu-cli print start ./benchy.3mf --plate 1
```

### 4）接入 OpenClaw 对话流程

将 CLI 输出作为上下文交给 OpenClaw，继续执行状态判断、runbook 引导和排障步骤。

## 结果（基于可证实信息）

- 可将 GUI 为主的打印流程转为可复用的命令步骤。
- profile 与优先级规则让多环境行为更可预测。
- 使用文件承载 access code，比直接在命令参数中传递密钥更稳妥。

## 已证实事实 vs 待验证点

### ✅ 已证实（来源可查）

- `bambu-cli` 通过 MQTT/FTPS/camera 控制 BambuLab 打印机。
- Homebrew 安装与快速上手命令有官方 README 说明。
- 配置优先级与端口要求有文档说明。
- OpenClaw Showcase 收录了 “Bambu 3D Printer Control”。

### ⚠️ 待验证（需用户访谈/埋点）

- 单次打印操作平均耗时下降幅度
- 从 GUI 迁移后失败率变化
- 多打印机场景下的吞吐提升

## 实战建议

- access code 建议落文件并限制权限（`chmod 600`）。
- 自动化前先确认 MQTT/FTPS/camera 端口可达。
- 把配置显式化，降低跨机器漂移风险。

## 参考链接

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [bambu-cli 仓库](https://github.com/tobiasbischoff/bambu-cli)
- [bambu-cli README](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)
