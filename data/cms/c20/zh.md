---
title: "OpenClaw + Home Assistant：AI 驱动的智能家居控制"
description: "将 OpenClaw 连接至 Home Assistant，通过自然语言控制您的智能家居。本文提供使用 Home Assistant MCP 服务器的分步配置指南，包含真实的自动化示例与语音指令模式。"
publishedAt: 2026-03-21
status: published
visibility: public
---

# OpenClaw + Home Assistant：AI 驱动的智能家居控制

传统智能家居自动化的方式是编写自动化规则：如果日落时有人在家，就打开客厅灯；如果工作日早上七点门被打开，就启动咖啡机。这些方式确实有效，但要求你提前预判各种场景并精确编码触发条件。

我想要的是另一种交互方式：只需说"这里有点热，调整一下让我更舒适"，AI 就能自行判断需要修改哪些实体、调整幅度以及操作顺序。这是一种截然不同的交互模式，而且效果出乎意料地好。

本文介绍如何使用 HA MCP 服务器将 OpenClaw 连接到 Home Assistant。配置完成后，你可以通过自然语言对话控制家居，让 OpenClaw 帮你编写自动化规则，诊断设备问题，并查询家居状态。

## 架构概述

该集成通过三个组件实现：

1. **Home Assistant** — 你现有的 HA 安装，2024 及以上任意版本均可
2. **Home Assistant MCP Server** — 将 HA 的 API 封装为 MCP 工具的桥接层
3. **OpenClaw** — 根据你的请求调用这些工具的 AI

当你说"关掉卧室所有灯"时，OpenClaw 将指令发送给模型，模型决定调用 `call_service` 工具，传入 `light.turn_off` 以及卧室实体 ID，MCP 服务器向 HA 执行该服务调用，HA 随即关闭灯光。

简单指令从输入到执行的往返时间通常为 1 到 3 秒。

## 前置条件

- Home Assistant 已安装并运行（HA OS、Supervised、Container 或 Core 均可）
- 来自 HA 的长期访问令牌（Long-Lived Access Token）
- OpenClaw 已安装
- Node.js 20 及以上版本

## 获取 Home Assistant 访问令牌

在 Home Assistant 中：
1. 点击左下角你的个人头像
2. 滚动至"长期访问令牌"（Long-Lived Access Tokens）
3. 点击"创建令牌"（Create Token）
4. 将其命名为"OpenClaw"，并立即复制令牌——它不会再次显示

## 安装 Home Assistant MCP Server

```bash
npm install -g @modelcontextprotocol/server-home-assistant
```

验证其是否正常运行：

```bash
HA_URL=http://homeassistant.local:8123 \
HA_TOKEN=your_token_here \
npx @modelcontextprotocol/server-home-assistant
# Should start without errors
```

## 配置 OpenClaw

将 MCP 服务器添加到 OpenClaw 配置文件中：

```yaml
# ~/.openclaw/config.yaml

mcpServers:
  home-assistant:
    command: npx
    args:
      - "@modelcontextprotocol/server-home-assistant"
    env:
      HA_URL: "http://homeassistant.local:8123"
      HA_TOKEN: "${HA_TOKEN}"
```

设置环境变量：

```bash
export HA_TOKEN="your_long_lived_access_token"
# Add to ~/.zshrc or ~/.bashrc to persist
```

重启 OpenClaw：

```bash
openclaw restart
openclaw mcp list
# Should show: home-assistant (X tools)
```

## 可用工具

HA MCP 服务器向 OpenClaw 暴露以下工具：

```
get_states              - List all entity states
get_state               - Get a specific entity's state and attributes
call_service            - Call any HA service (turn on lights, etc.)
get_config              - Get HA configuration details
get_history             - Get historical state data for an entity
get_logbook             - Get logbook entries
list_automations        - List all automations
get_automation          - Get automation YAML
create_automation       - Create a new automation
get_template            - Evaluate a Jinja2 template
```

这是一套覆盖面极广的接口——模型几乎可以完成你在 HA 界面中能做的一切操作。

## 基础指令

连接完成后，自然语言指令即刻生效：

```
"客厅现在的温度是多少？"
"关掉所有灯"
"将卧室恒温器设置到 68°F"
"家里有人吗？"
"锁上前门"
"显示所有传感器的电量"
```

模型会将这些指令转换为相应的服务调用。对于"关掉所有灯"这类涉及多实体的指令，它会先调用 `get_states` 查找所有灯光实体，再对相关实体调用 `call_service`。

## 实际示例

**按需执行晨间程序：**

```
你："早上好，帮我把家里设置成早晨的状态——我大约 45 分钟后出门"

OpenClaw：我来为你设置晨间程序。
- 厨房灯 → 亮度 80%，暖白色
- 咖啡机 → 开启（如果实体可用）
- 客厅百叶窗 → 打开
- 恒温器 → 70°F
- 前门锁 → 确认已锁

还需要为你的早晨做其他安排吗？
```

**诊断设备问题：**

```
你："我办公室的移动传感器两天没有触发了，是怎么回事？"

OpenClaw：[调用传感器实体的 get_history]

查看 binary_sensor.office_motion 历史记录：
- 上次触发：2 天前，上午 9:47
- 电量：8%（3 天前最后上报）
- 当前状态：不可用

传感器已显示不可用，结合电量仅剩 8%，说明可能已耗尽电量。更换电池后应自动重新连接。如果 10 分钟内未重新连接，可能需要重新与你的 Zigbee/Z-Wave 协调器配对。
```

**编写自动化规则：**

```
你："创建一个自动化：日落后前门打开时打开门廊灯，门关闭后 5 分钟关闭门廊灯"

OpenClaw：[调用 list_automations 检查是否存在冲突，然后调用 create_automation]

已创建自动化"日落后开门时打开门廊灯"：
- 触发条件：front_door 状态变为 'open'
- 执行条件：太阳位于地平线以下
- 操作：打开 porch_light
- 附加触发条件：front_door 状态变为 'closed'
- 附加操作：延迟 5 分钟后关闭 porch_light

自动化已激活。需要我通过模拟开门事件来测试一下吗？
```

**能源监控查询：**

```
你："当前哪些设备耗电量最高？"

OpenClaw：[调用 get_states 获取所有电量监控实体]

当前功耗（从高到低）：
1. 暖通空调系统：2,340W
2. 烤箱（忘关了！）：1,800W
3. 电动汽车充电器：1,200W
4. 冰箱：145W
5. 电视 + 娱乐设备：87W

注意：烤箱似乎处于开启状态——是有意为之吗？当前总功耗约 5.6kW。
```

## 安全注意事项

HA MCP 服务器在本地运行，直接与 HA 实例通信。以下是重要的安全要点：

**限制 OpenClaw 的操作权限。** HA 的访问令牌默认具有对实例的完全访问权限。如需更严格的限制，可考虑使用 HA 的 API 密钥范围限制（部分 HA 版本支持），或部署一个代理来限制可调用的服务。

**不要暴露 HA 的外部 URL。** 将 MCP 服务器配置为使用本地 HA 地址，而非外部 HA Cloud URL。所有通信应保持在本地网络内。

**激活前审查自动化规则。** 让 OpenClaw 创建自动化时，在规则上线前请先审查 YAML 内容。模型表现良好但并非无懈可击——请检查边界情况。

```yaml
# More restrictive config: use local network only
mcpServers:
  home-assistant:
    env:
      HA_URL: "http://192.168.1.100:8123"  # Direct IP, not external URL
      HA_TOKEN: "${HA_TOKEN}"
```

**记录 OpenClaw 的操作日志。** 在 HA 中，为你关注的实体启用日志记录。如果发生意外情况，可以追溯到是哪个服务在何时被调用。

## 进阶：语音指令

将 OpenClaw 的 MCP 集成与其语音输入支持结合，实现免手动操作的家居控制：

```bash
# OpenClaw with voice input (when configured)
openclaw voice --provider home-assistant

# Or use the keyboard shortcut in OpenClaw's terminal UI
# Voice input → transcription → model processes → HA executes
```

语音到执行的延迟通常合计为 3 到 5 秒：语音转录约 1 秒，模型推理约 1 到 2 秒，HA 服务执行约 1 秒。

## 管理多个住宅或区域

如果你有多个 HA 实例（主要住所 + 度假屋），可配置多个 MCP 服务器实例：

```yaml
mcpServers:
  home-main:
    command: npx
    args: ["@modelcontextprotocol/server-home-assistant"]
    env:
      HA_URL: "http://homeassistant.local:8123"
      HA_TOKEN: "${HA_TOKEN_MAIN}"

  home-vacation:
    command: npx
    args: ["@modelcontextprotocol/server-home-assistant"]
    env:
      HA_URL: "https://vacation-home.duckdns.org:8123"
      HA_TOKEN: "${HA_TOKEN_VACATION}"
```

模型可同时处理两者："检查度假屋的灯是否有人忘记关。"

## 常见问题

**这与我的 Zigbee/Z-Wave/Matter/WiFi 设备兼容吗？**

兼容。OpenClaw 与 Home Assistant 的实体层交互，该层对所有设备协议进行了抽象。只要设备在 HA 中以实体形式出现，OpenClaw 就可以控制它。

**OpenClaw 会不会误操作出问题？**

模型会调用真实的 HA 服务，理论上可能会调用你并非有意触发的服务。实际上，模型对破坏性操作持保守态度，通常在执行不可逆操作（如禁用警报）前会请求确认。请始终监督意外指令。

**这与 Home Assistant Cloud（Nabu Casa）兼容吗？**

兼容。使用 HA Cloud 的外部 URL 代替本地地址即可。由于需要额外经过云端的往返，性能会略慢一些。

**如果我的 HA 实例有数百个实体怎么办？**

`get_states` 调用会返回所有实体，数据量可能较大。模型能够正常处理，但响应速度可能略慢。对于实体数量极多（500 个以上）的安装，建议在指令中按域过滤："显示所有灯光实体。"

**可以与 Ollama 离线方案配合使用吗？**

可以。MCP 服务器与模型后端相互独立。将 OpenClaw 配置为使用 Ollama 作为提供商，HA MCP 服务器依然可用。如此一来，你的智能家居控制将完全离线运行（前提是 HA 部署在本地）。

OpenClaw + Home Assistant 的集成改变了我与家居的交互方式。通过对话编写自动化规则，比直接编辑 YAML 更加自然；用自然语言提出诊断问题，也大幅节省了排障时间。对于已有 HA 安装的用户，整个配置过程大约只需 15 分钟。
