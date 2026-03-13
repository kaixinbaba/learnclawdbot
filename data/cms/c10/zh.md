---
title: "OpenClaw + DeepSeek：真正好用的低成本 AI 助手"
description: "教你如何将 DeepSeek V3/R1 接入 OpenClaw，构建高性能、低预算的 AI 助手。真实 API 成本对比、配置教程与诚实的性能评估。"
publishedAt: 2026-03-14
status: published
visibility: public
---

# OpenClaw + DeepSeek：真正好用的低成本 AI 助手

大多数运行 AI 助手的人最终都会碰到同一个问题：API 账单。GPT-4o 每百万输出 token 10 美元，听起来还行——直到你有五个人在每天使用它，或者开始运行文档分析、多步骤编程等长任务。那时候，成本就从理论变成了现实。

DeepSeek 显著改变了这个算账逻辑。以 OpenClaw 作为网关，它已经成为那些想要真正 AI 能力、又不接受每月意外账单的人的首选组合。

## 为什么选 DeepSeek？真实数字说话

以下为 2026 年初的定价（来源：[platform.deepseek.com](https://platform.deepseek.com)）：

| 模型 | 输入（每百万 token） | 输出（每百万 token） | 适用场景 |
|---|---|---|---|
| DeepSeek-V3 | ~$0.27（约¥2.0） | ~$1.10（约¥8.0） | 编程、问答、起草、摘要 |
| DeepSeek-R1 | ~$0.55（约¥4.0） | ~$2.19（约¥16.0） | 数学、逻辑、多步推理 |
| GPT-4o | ~$2.50 | ~$10.00 | 通用 |
| Claude 3.5 Sonnet | ~$3.00 | ~$15.00 | 复杂写作、分析 |

算法很直观：以典型用量（每月约 50 万输出 token）计算，DeepSeek-V3 约需 $0.55，GPT-4o 约需 $5，Claude Sonnet 约需 $7.5。对于每月产出 500 万 token 的小团队，这个差距会放大到数百美元。

**一个坦诚的提醒**：DeepSeek 的 API 偶尔会出现可用性问题——每次发布新模型时，服务器会承受很大压力。这也是为什么下文中的故障转移配置很重要。

## V3 还是 R1？如何选择

在配置之前，值得认真想清楚这个问题：

**DeepSeek-V3** 是绝大多数任务的正确默认选项：写作、编程辅助、问答、文档摘要、结构化数据提取。响应速度快（典型查询 P50 延迟低于 2 秒），性价比极高。

**DeepSeek-R1** 在推理链条重要的任务上值回票价——调试复杂算法、处理多约束优化问题、分析法律文件中的矛盾点。对于简单问题，R1 的扩展思考会增加延迟却不带来收益。

实用原则：默认用 V3，当发现 V3 在逻辑上出错时，再为该对话切换到 R1。

## 配置教程

将 DeepSeek 接入 OpenClaw 有两种方式：Dashboard 图形界面（更简单）或直接编辑 `.env` 文件。

### 方式一：Dashboard 图形界面

1. 打开 OpenClaw Dashboard，访问 `http://localhost:3000`
2. 进入 **设置 → AI 提供商**
3. 点击 **添加提供商**，选择 **DeepSeek**
4. 粘贴来自 [platform.deepseek.com](https://platform.deepseek.com) 的 API Key
5. 选择模型（V3 选 `deepseek-chat`，R1 选 `deepseek-reasoner`）
6. 点击 **保存并测试**——绿色对勾表示连接成功

### 方式二：编辑 `.env` 文件

打开 OpenClaw 根目录，添加以下内容：

```bash
# DeepSeek 提供商配置
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat        # DeepSeek-V3
# DEEPSEEK_MODEL=deepseek-reasoner  # 取消注释以使用 DeepSeek-R1
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

然后重启 OpenClaw。不同部署方式（裸 Node.js、Docker、systemd 服务）的重启命令有所不同，请参阅 [OpenClaw 文档](https://docs.openclaw.ai)。

### 按技能分配模型

一个常被忽视的功能：你可以为不同技能指定不同模型，将 R1 保留给真正需要深度推理的场景：

```json
{
  "skill": "code-review",
  "modelOverride": "deepseek-reasoner",
  "description": "深度代码分析时使用 R1"
}
```

这样在保持整体低成本的同时，在关键场景获得 R1 的推理能力。

## 配置故障转移（重要）

DeepSeek 便宜，但可靠性在高峰时期并不总是最好的。配置故障转移意味着即便 DeepSeek 故障，你的助手依然正常运行。在 OpenClaw 的提供商设置中配置备用顺序——具体格式请参阅 [提供商配置文档](https://docs.openclaw.ai)，因为不同版本之间有差异。

核心思路：将 DeepSeek 设为主选，OpenAI 或 Anthropic 作为备用。DeepSeek 故障时，OpenClaw 自动切换备用再返回结果。对于成本敏感的工作流，你也可以配置为直接报错而非切换到昂贵的备用提供商——这也是可以设置的。

## 诚实的性能评估

在 OpenClaw 中运行 DeepSeek-V3 处理真实任务数周之后，以下是我的发现：

**编程**：V3 在 Python、JavaScript、SQL 场景下与 GPT-4o 真正具有竞争力。复杂架构问题未必一次就对，但 GPT-4o 也一样。日常代码生成和调试，质量差异可以忽略不计。

**写作与摘要**：V3 表现优秀。速度比 Claude 快，价格低得多——文档摘要场景已经成为我的默认选择。

**指令跟随**：V3 能可靠处理复杂的多步骤提示词。一个常见问题：系统提示词过长、约束过多时容易出错。将系统提示词控制在 500 字以内可以消除大部分问题。

**长上下文**：V3 和 R1 均支持 64K 上下文窗口，足以处理大多数真实文件的文档问答任务。

**诚实的结论**：如果你目前在为典型助手任务支付 GPT-4o 或 Claude 的费用，将 80% 的任务切换到 DeepSeek-V3，只在真正需要时使用昂贵模型，账单会大幅下降，而质量损失微乎其微。

## 相关阅读

- [OpenClaw 对比 Claude Code：该选哪个？](/blog/claude-code-vs-openclaw) — 如果你还在考虑是自托管 OpenClaw 还是直接用 Claude Code
- [在树莓派 5 上运行 OpenClaw](/blog/openclaw-raspberry-pi-5) — 如果你想在 100 美元的家用服务器上跑这套配置

## 常见问题

**用于工作数据安全吗？**
DeepSeek 的 API 托管在他们的服务器上——你的提示词和数据会发送到他们的基础设施。对于敏感业务数据，请查阅他们的[隐私政策](https://platform.deepseek.com)，并考虑本地部署开源模型是否更符合你的合规需求。

**DeepSeek-V3 支持中文吗？**
支持，且表现很好。V3 和 R1 对中文的处理能力都很强——这在意料之中，毕竟 DeepSeek 来自中国团队。日语、西班牙语、法语、德语等也有良好支持。

**能同时使用 DeepSeek 和 GPT-4o 吗？**
可以——配置多个提供商，通过按技能的模型覆盖（model override）将不同任务路由到不同提供商。

**达到 DeepSeek 速率限制怎么办？**
配置了故障转移后，OpenClaw 自动切换备用提供商重试。没有故障转移的情况下，聊天界面会返回错误消息。付费计划的速率限制较为宽松；免费 Key 的限制更严格。

**计费方式是怎样的——直接向 DeepSeek 付费吗？**
是的。OpenClaw 是网关软件；你根据消耗的 token 量直接向 DeepSeek 支付 API 费用。OpenClaw 本身不在 API 成本上加价。
