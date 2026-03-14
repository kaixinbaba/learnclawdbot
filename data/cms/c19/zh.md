---
title: "离线 AI：使用 Ollama 运行 OpenClaw 实现完全隐私"
description: "通过 Ollama 和本地模型让 OpenClaw 完全离线运行。数据不离开您的机器，无需 API 密钥。包含模型选择、性能调优和实际使用场景的完整设置指南。"
publishedAt: 2026-03-20
status: published
visibility: public
---

# 离线 AI：使用 Ollama 运行 OpenClaw 实现完全隐私

每当您向任何云端 AI 服务发送消息，那条消息就会离开您的机器。它会经过 CDN，被服务提供商记录，甚至可能用于训练或被人工审查。对于大多数日常用途，这是可以接受的权衡。但对于其他情况——专有代码、个人数据、敏感商业逻辑、机密文件——则完全不可接受。

我开始探索本地 AI 是出于一个具体原因：我想用 AI 助手分析包含个人身份信息（PII）的客户支持工单。使用云端 API 处理这些数据会带来真实的合规问题。完全本地运行干净地解决了这个问题。此后，我的本地设置逐步扩展，现在已成为处理任何敏感工作的主要环境。

本指南介绍如何以 Ollama 作为模型后端，让 OpenClaw 完全离线运行。完成配置后，您将拥有一个无需网络连接即可工作、在本地处理所有数据、无需 API 密钥的 AI 助手。

## 为什么选择 Ollama

Ollama 是本地运行大语言模型最简单的方式。它处理模型下载、GGUF 格式转换、硬件加速检测，并提供与 OpenAI 聊天补全规范兼容的 REST API。最后这一点使它无需任何特殊集成代码即可与 OpenClaw 配合工作。

其他选择也存在——LM Studio、直接使用 llama.cpp、LocalAI——但 Ollama 在简单性和功能性之间取得了恰当的平衡。安装后拉取模型，它就能提供 API 服务。OpenClaw 连接该 API 的方式与连接 OpenAI 完全相同。

## 系统要求

本地模型需要真实的算力。按使用场景的实际最低要求：

**基础使用（70 亿参数模型）：**
- 内存：8GB（没有 GPU 时模型部分在内存中运行）
- GPU 显存：4GB 用于 GPU 加速
- 存储：每个模型 5-10GB

**良好性能（130 亿参数模型）：**
- 内存：16GB
- GPU 显存：8GB
- 存储：每个模型 8-15GB

**高质量（300 亿参数以上）：**
- 内存：32GB+
- GPU 显存：16GB+（或使用统一内存的 Apple Silicon）
- 存储：每个模型 20-50GB

具有统一内存的 Apple Silicon Mac（M1/M2/M3/M4）特别适合本地模型运行。配备 32GB 统一内存的 MacBook Pro 可以流畅运行 340 亿参数模型。

## 安装 Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows：从 ollama.com 下载安装程序

# 验证安装
ollama --version
```

启动 Ollama 服务：

```bash
ollama serve
# 或在 macOS 上，安装后作为菜单栏应用运行
```

## 选择模型

模型选择是本次设置中最关键的决定。更大并不总是更好——一个能完全载入 GPU 显存的小模型，其性能将大幅优于一个在内存中运行的大模型。

**最适合编码和技术任务的模型：**

```bash
# 专注于代码，在技术问题上表现出色
ollama pull codellama:13b

# Qwen2.5-Coder：代码理解能力出色
ollama pull qwen2.5-coder:14b

# DeepSeek-Coder：代码补全能力强
ollama pull deepseek-coder-v2:16b
```

**最适合通用写作和分析的模型：**

```bash
# Llama 3.1：该尺寸最佳通用模型
ollama pull llama3.1:8b

# Mistral：70 亿参数下速度快、质量好
ollama pull mistral:7b

# Gemma 2：谷歌开源模型，推理能力好
ollama pull gemma2:9b
```

**追求最佳质量的大型模型：**

```bash
# Llama 3.1 70B（需要约 40GB 内存或 24GB+ 显存）
ollama pull llama3.1:70b

# Qwen2.5 32B（在特定任务上优于许多更大的模型）
ollama pull qwen2.5:32b
```

连接 OpenClaw 前先测试模型：

```bash
ollama run mistral:7b "用一段话解释什么是 MCP 服务器"
```

如果能正常运行且响应质量可接受，就可以连接了。

## 配置 OpenClaw 使用 Ollama

OpenClaw 通过 Ollama 的 OpenAI 兼容 API 进行连接。编辑 OpenClaw 配置：

```yaml
# ~/.openclaw/config.yaml

providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"  # Ollama 不需要真实的密钥，但字段必须存在
    models:
      - id: mistral:7b
        name: "Mistral 7B（本地）"
        contextWindow: 32768
      - id: llama3.1:8b
        name: "Llama 3.1 8B（本地）"
        contextWindow: 131072
      - id: codellama:13b
        name: "CodeLlama 13B（本地）"
        contextWindow: 16384

defaultProvider: ollama-local
defaultModel: mistral:7b
```

重启 OpenClaw 并验证连接：

```bash
openclaw status
# 应显示：提供商：ollama-local，模型：mistral:7b
```

## 验证离线操作

配置完成后，验证在没有网络的情况下一切正常：

```bash
# 禁用网络（macOS）
networksetup -setnetworkserviceenabled Wi-Fi off

# 测试 OpenClaw
openclaw chat "15 乘以 37 等于多少？"

# 重新启用网络
networksetup -setnetworkserviceenabled Wi-Fi on
```

即使网络被禁用，您也应该能收到响应。如果 OpenClaw 挂起或报错，请检查 Ollama 是否仍在服务（它应该是的——Ollama 在模型下载后不需要网络连接）。

## 性能调优

本地模型比云端 API 慢。以下是真正影响速度的因素：

**GPU 加速是最大的单一因素。** 验证 Ollama 是否在使用您的 GPU：

```bash
ollama run mistral:7b "" --verbose
# 寻找：「使用 GPU：NVIDIA GeForce...」或「使用 Metal：Apple M...」
```

如果存在兼容的 GPU 却只在 CPU 上运行，请安装相应驱动（NVIDIA 用 CUDA，AMD 用 ROCm）。在配备 Apple Silicon 的 macOS 上，Metal 加速是自动的。

**CPU 回退的并行线程数：**

```bash
# 在 Ollama 的环境中（Linux 上创建 /etc/ollama/ollama.conf）
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1
```

**上下文大小对速度影响显著。** 70 亿参数模型上的 128K 令牌上下文窗口比 8K 上下文慢得多。如果不需要长上下文，请明确配置：

```yaml
# 在 OpenClaw 配置中
providers:
  - name: ollama-local
    models:
      - id: mistral:7b
        contextWindow: 8192  # 更小的上下文 = 更快的响应
```

**保持模型加载状态。** Ollama 会在超时后卸载模型。开发时，保持模型预热：

```bash
# 每隔几分钟发送空请求来保持模型加载
while true; do
  curl -s http://localhost:11434/api/generate \
    -d '{"model":"mistral:7b","prompt":"","keep_alive":"10m"}' > /dev/null
  sleep 300
done
```

## 实际使用场景

**对专有代码库进行代码审查：**

```bash
cd /path/to/private-project
openclaw chat "检查这个文件是否存在安全问题" --files src/auth/jwt.ts
```

没有任何内容离开您的机器。整个代码分析在本地完成。

**分析敏感文档：**

```bash
openclaw chat "总结这份合同的关键义务" --files contract.pdf
```

支持 PDF、文本文件、代码文件——任何 OpenClaw 文件处理支持的格式。

**在断网系统上运行：**

某些生产环境没有网络访问。一旦安装了 Ollama 和 OpenClaw 并下载了模型，整个技术栈可以在气隙环境中工作。

**本地知识库搜索：**

结合 OpenClaw 的上下文加载：

```bash
openclaw chat --context /path/to/internal/docs "我们的支付集成是如何工作的？"
```

模型仅使用您的本地文档来回答。

## FAQ

**我可以在 Ollama 模型上使用 OpenClaw 的工具使用和 MCP 功能吗？**

大多数 Ollama 模型支持函数调用/工具使用。兼容性因模型而异。CodeLlama、Llama 3.1 和 Mistral 支持得很好。请查看 Ollama 网站上的模型文档。在本地模型中使用 MCP 服务器时，请测试模型是否正确调用工具——一些较小的模型在处理复杂工具 schema 时可能遇到困难。

**如何更新 Ollama 模型？**

```bash
ollama pull mistral:7b  # 重新拉取会获取最新版本
ollama list             # 查看所有已下载的模型
ollama rm mistral:7b    # 删除模型以释放空间
```

**我可以同时运行多个模型吗？**

可以，但每个加载的模型都占用内存。在 32GB 的系统上，通常可以同时运行两个 70 亿参数的模型。在 Ollama 的环境中配置 `OLLAMA_MAX_LOADED_MODELS=2`。

**OpenClaw 的内存/会话持久性在本地模型下能用吗？**

可以。OpenClaw 的会话管理独立于模型后端。本地会话、上下文加载和对话历史在 Ollama 下的工作方式与云端模型完全相同。

**关于量化——我应该使用 Q4 还是 Q8？**

Ollama 默认使用 Q4_K_M 量化，这是一个很好的平衡。Q8 以更高的内存使用为代价提供更好的质量。对于 70 亿参数模型：Q4 使用约 4GB 显存，Q8 使用约 8GB。如果您有足够的显存，Q8 是值得的。拉取时指定量化版本：

```bash
ollama pull mistral:7b-instruct-q8_0
```

我在这里描述的离线 AI 设置已成为我处理敏感工作的标准环境。对于隐私敏感的任务，质量已经足够好，我几乎不需要切换到云端 API，而隐私保证是完整的——数据永远不会离开机器。
