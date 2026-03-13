---
title: "在树莓派 5 上运行 OpenClaw：安装、性能与真实预期"
description: "在树莓派 5 上搭建私有、全天候的本地 AI 网关。诚实的 ARM64 安装指南、有限内存下的模型推荐，以及实用场景分析。"
publishedAt: 2026-03-14
status: published
visibility: public
---

# 在树莓派 5 上运行 OpenClaw：安装、性能与真实预期

树莓派 5 运行 OpenClaw 作为轻量级 AI 网关是完全可行的——但"可行"需要一点上下文。它跑不了 700 亿参数的本地模型。它*能做到*的是：作为家庭设备与云端 AI 提供商之间的持久、私有路由节点，如果选择合适的模型，也能处理轻量的本地推理。

本指南涵盖真实的安装流程、不同硬件配置下的合理预期，以及哪些 AI 模型在树莓派 5 的资源限制下实际表现良好。

## 硬件：你真正需要什么

树莓派 5 有两种内存配置，对这个使用场景影响显著：

**4GB 版本（约 400 元）**：足以将 OpenClaw 作为云 API 网关运行。你在做的是把请求路由到 DeepSeek、OpenAI 或其他提供商——OpenClaw 本身用不了多少内存。如果想加本地推理，就比较紧张了。

**8GB 版本（约 550 元）**：如果你想尝试在树莓派上运行小型本地模型（3B–7B 参数）并与 OpenClaw 共存，推荐这个版本。多出的内存余量很关键。

除了主板本身，存储选择的影响往往比大多数教程承认的更大：

- **microSD 卡**：用于测试没问题。在写密集型工作负载（OpenClaw 的对话历史、日志）下会变慢。在持续使用下，卡的寿命比预期短。
- **通过 M.2 扩展板接 NVMe 固态硬盘**：生产级部署的正确选择。树莓派 5 的 PCIe 2.0 接口速度足够，一块入门 NVMe（128GB 约 100 元）的性能远超任何 microSD 卡。

散热方面：树莓派 5 在 85°C 以上会降频。在运行 Node.js 的峰值负载下，没有主动散热就会触发。官方树莓派 5 主动散热器（约 30 元）或 Pimoroni Pico HAT 能干净解决这个问题。

**一套稳固配置的总硬件成本**：树莓派 5（8GB）+ M.2 扩展板 + 128GB NVMe + 主动散热器 + 27W USB-C 电源 ≈ 900–1100 元。

## 系统安装

### Raspberry Pi OS（64 位）——推荐

使用 Raspberry Pi Imager 烧录 64 位 Raspberry Pi OS（Bookworm）。在 Imager 的高级选项中，烧录前开启 SSH 并设置主机名——这能省掉很多首次启动的麻烦。

首次启动后：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

使用无图形界面模式（无桌面）节省约 150MB 内存并降低空闲 CPU 占用：

```bash
sudo raspi-config
# → 系统选项 → 启动/自动登录 → 控制台自动登录
```

### Docker（备选方案）

如果你更喜欢容器化部署，方便更新且环境隔离更干净：

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y docker-compose-plugin
```

## 在 ARM64 上安装 OpenClaw

OpenClaw 完整支持 ARM64（aarch64）架构。请参阅 [docs.openclaw.ai](https://docs.openclaw.ai) 上针对你具体版本的官方安装指南——不同版本和部署方式的步骤略有差异。

**基本流程如下：**

**1. 通过 NodeSource 安装 Node.js 20.x：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # 验证：应显示 v20.x.x
```

**2. 按照 [docs.openclaw.ai](https://docs.openclaw.ai) 安装 OpenClaw**。文档会说明使用源码克隆、发布包还是 Docker 镜像——具体取决于版本。

**3. 编辑 `.env` 文件**，填入你的 API Key 和提供商配置。

### 配置为系统服务

让 OpenClaw 随系统开机自启，创建一个 systemd 服务：

```bash
sudo nano /etc/systemd/system/openclaw.service
```

```ini
[Unit]
Description=OpenClaw AI Gateway
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/openclaw
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=1024

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

`NODE_OPTIONS=--max-old-space-size=1024` 这一行将 Node.js 的堆内存上限从默认的约 512MB 提升到 1GB——在 4GB 树莓派上很重要。8GB 版本可以将此值调整到 2048。

## 交换空间配置（4GB 版本）

添加交换空间作为内存峰值时的安全保障：

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# 设置：CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

使用 NVMe 时，交换空间性能尚可接受。用 microSD 时，交换会慢到产生明显卡顿——这是在任何正式工作负载下使用 NVMe 的又一个理由。

## 树莓派 5 上适合用哪些 AI 模型？

这是大多数教程含糊其辞的地方。以下是诚实的建议：

**作为云端网关**（不做本地推理）：任何模型都可以用。OpenClaw 将 API 请求路由到 DeepSeek、OpenAI、Anthropic 等——树莓派 5 只负责管理连接，CPU 和内存使用保持较低水平。这是推荐大多数人采用的方案。最便宜的云端选项请参阅 [OpenClaw + DeepSeek 配置教程](/blog/openclaw-deepseek-low-cost)。

**本地推理**（模型直接在树莓派上运行）：坚持使用小模型。树莓派 5 的 Cortex-A76 CPU 在超过几十亿参数的模型上生成 token 会很慢。

树莓派 5（8GB）实际可用的本地模型：
- **Qwen2.5 1.5B 或 3B**（通过 Ollama 或 llama.cpp）：速度足够交互对话，质量合理
- **Llama 3.2 3B**：这个规模下性能不错的通用模型
- **Phi-3 Mini（3.8B）**：编程和推理能力在同等规模中较强

除非你准备接受非常慢的 token 生成速度（通常 1–3 个 token/秒），否则避免在树莓派 5 上加载 7B+ 的模型。作为参考：一个 7B 模型以 Q4 量化运行大约需要 4GB 内存——4GB 版本几乎没有留给操作系统和 OpenClaw 的余地。

OpenClaw 可以通过 OpenAI 兼容 API 端点连接本地运行的 Ollama 实例，在 `.env` 或 Dashboard 设置中像配置其他提供商一样配置即可。

## 实用场景

以下是树莓派 5 运行 OpenClaw 全天候部署中实际效果良好的场景：

**私有文档问答**：将 OpenClaw 指向一个 PDF 或文本文件夹，对其进行问答。所有处理要么完全在本地进行（使用本地模型），要么发送到你选择的云提供商——没有第三方服务持有你的文档。

**Home Assistant 集成**：OpenClaw 的 Webhook 插件可以通过自然语言触发 Home Assistant 自动化。"20 分钟后关闭所有灯"变成在你的树莓派上本地处理的指令。配合语音接口尤为好用——参阅[语音助手配置教程](/blog/voice-assistant-openclaw)。

**本地网络监控**：定时运行 OpenClaw 检查设备可用性、汇总 Pi-hole 拦截统计，或 ping 服务并通过消息应用提醒你。

**个人日记与笔记**：通过消息插件从手机发送笔记或语音备忘录，自动处理、标记并建立可搜索的索引。

**家庭 AI 聊天网关**：家人可以向 WhatsApp 或 Telegram 号码发消息获得 AI 回复，无需每个人单独申请 API 账号。

## 常见问题

**树莓派 5 能在没有任何云 API 的情况下离线运行模型吗？**
可以，通过 Ollama 搭配小型模型（1.5B–3B 参数）。预期质量会明显低于 GPT-4o 级别的模型。对于大多数实际家庭任务，通过 OpenClaw 路由到云 API 的效果要好得多，成本也极低。

**用电量是多少？**
树莓派 5 待机约 5W，持续满载约 12W。按典型使用模式（大部分时间待机，偶尔有突发负载），每月用电量预计远低于 5 度——在大多数地区只需几分钱。

**在家庭网络上运行安全吗？**
OpenClaw 的 Dashboard 不应在没有认证的情况下暴露到公网。把它放在防火墙后面，通过 VPN 或 SSH 隧道进行远程访问。如果使用 Twilio 或其他 Webhook，只暴露特定的 Webhook 端点，而不是整个 Dashboard。

**断网时会怎样？**
如果使用云提供商，断网期间助手无法处理请求。如果通过 Ollama 运行了本地模型，基本功能可以离线维持。

**该选 4GB 还是 8GB 版本？**
纯云网关用途：4GB 足够。想要本地模型实验或计划同时运行多个技能：8GB。
