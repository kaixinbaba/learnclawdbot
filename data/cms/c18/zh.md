---
title: "OpenClaw 自动化：Cron 任务、Webhook 与事件驱动 AI 流水线"
description: "超越交互式聊天，使用 OpenClaw 的 API 构建自动化：定时任务、Webhook 触发工作流、CI/CD 集成和批量处理流水线，附真实代码示例。"
publishedAt: 2026-03-19
status: published
visibility: public
---

# OpenClaw 自动化：Cron 任务、Webhook 与事件驱动 AI 流水线

大多数开发者发现 OpenClaw 的方式和我一样：安装好之后，打开终端的聊天界面，开始交互式地提问。这种用法确实很有价值，但那只是表面。

OpenClaw 暴露了一套完整的 HTTP API，兼容 OpenAI 的 chat completions 规范。这意味着任何能发起 HTTP 请求的脚本、cron 任务、webhook 处理器或 CI/CD 流水线，都可以以编程方式驱动 OpenClaw。在过去一年里，我在自托管的 OpenClaw 实例之上构建了一套自动化体系，显著改变了我的工作方式：每晚生成代码质量报告，早上喝咖啡时阅读；每当我提交 pull request 时自动进行代码审查；Slack 消息触发 AI 任务进入队列；批量任务将数千行日志压缩成可操作的摘要。

本文记录了我在生产环境中实际使用的模式，附带可直接改用的真实代码。目标是让你从"我用 OpenClaw 进行交互式聊天"升级到"OpenClaw 是我自动化基础设施的一部分"。

## OpenClaw HTTP API

在构建自动化之前，你需要理解底层协议。OpenClaw 的 API 服务器默认在 `localhost:11434` 上启动。自动化场景中你最常用的接口是：

```
POST http://localhost:11434/api/chat
```

它接收一个 JSON 请求体，返回完整响应或流式响应。最简结构如下：

```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "用一句话总结：天空是蓝色的，因为瑞利散射。"}
    ],
    "stream": false
  }'
```

响应 JSON 格式如下：

```json
{
  "model": "llama3.2",
  "created_at": "2026-03-19T08:00:00Z",
  "message": {
    "role": "assistant",
    "content": "天空呈现蓝色，是因为大气层中的分子对阳光中较短的蓝色波长的散射比较长的红色波长更强烈。"
  },
  "done": true,
  "total_duration": 1823456789,
  "eval_count": 38
}
```

自动化场景中关键字段是 `message.content`（答案）和 `eval_count`（消耗的 token 数量——对成本追踪至关重要）。在需要等待完整响应才能继续的脚本中，设置 `"stream": false`；在将输出管道到终端或流式 HTTP 处理器时，使用 `"stream": true`。

如果你的工具链期望 OpenAI 格式，也可以使用兼容端点：

```bash
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Python 客户端基础

我的大多数自动化脚本都是用 Python 写的。以下是我在所有脚本中复用的客户端封装：

```python
# openclaw_client.py
import httpx
import json
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

OPENCLAW_BASE_URL = "http://localhost:11434"

def query(
    prompt: str,
    model: str = "llama3.2",
    system: Optional[str] = None,
    temperature: float = 0.3,
    max_retries: int = 3,
    timeout: int = 120,
) -> dict:
    """
    向 OpenClaw 发送 prompt 并返回完整响应字典。
    对瞬态错误使用指数退避重试。
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }

    for attempt in range(max_retries):
        try:
            response = httpx.post(
                f"{OPENCLAW_BASE_URL}/api/chat",
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            wait = 2 ** attempt
            logger.warning(f"第 {attempt + 1} 次尝试超时，{wait}s 后重试")
            time.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"服务器错误 {e.response.status_code}，{wait}s 后重试")
                time.sleep(wait)
            else:
                raise
        except httpx.ConnectError:
            wait = 2 ** attempt
            logger.warning(f"连接被拒绝，OpenClaw 是否在运行？{wait}s 后重试")
            time.sleep(wait)

    raise RuntimeError(f"OpenClaw 查询在 {max_retries} 次尝试后失败")


def query_text(prompt: str, **kwargs) -> str:
    """便捷封装，只返回文本内容。"""
    result = query(prompt, **kwargs)
    return result["message"]["content"]
```

重试逻辑非常重要。在自动化场景中，OpenClaw 可能在模型加载或系统重启期间短暂不可用。指数退避能在无需人工干预的情况下处理这些瞬态故障。

## 模式一：定时 Cron 任务

### 每日代码质量报告

我每天早上 6 点运行此任务。它会获取昨天以来仓库中所有修改过的文件，发送给 OpenClaw 进行快速质量审查，并在我坐到桌前之前将报告发送到我的邮箱。

```python
#!/usr/bin/env python3
# scripts/daily_code_review.py

import subprocess
import datetime
import smtplib
from email.mime.text import MIMEText
from openclaw_client import query_text

REPO_PATH = "/home/user/projects/myapp"
RECIPIENT = "me@example.com"
MODEL = "codellama:13b"  # 针对此任务使用专注于代码的模型

def get_changed_files() -> list[str]:
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    result = subprocess.run(
        ["git", "diff", "--name-only", f"HEAD@{{yesterday}}"],
        cwd=REPO_PATH,
        capture_output=True,
        text=True,
    )
    return [f for f in result.stdout.strip().split("\n") if f.endswith((".py", ".ts", ".go"))]


def get_file_diff(filepath: str) -> str:
    result = subprocess.run(
        ["git", "diff", f"HEAD@{{yesterday}}", "--", filepath],
        cwd=REPO_PATH,
        capture_output=True,
        text=True,
    )
    # 截断大型 diff 以避免 token 溢出
    return result.stdout[:4000]


def review_file(filepath: str, diff: str) -> str:
    prompt = f"""审查文件 `{filepath}` 的这段代码 diff。
识别：
1. 潜在的 bug 或逻辑错误
2. 安全隐患（SQL 注入、未验证的输入等）
3. 性能问题
4. 缺失的错误处理
5. 代码风格问题

保持简洁。如果 diff 看起来没问题，请说"未发现问题"。

Diff:
```
{diff}
```"""
    return query_text(prompt, model=MODEL, temperature=0.1)


def build_report(reviews: dict[str, str]) -> str:
    lines = [f"# 每日代码审查 — {datetime.date.today()}\n"]
    for filepath, review in reviews.items():
        lines.append(f"## `{filepath}`\n")
        lines.append(review)
        lines.append("")
    return "\n".join(lines)


def send_report(report: str):
    msg = MIMEText(report, "plain")
    msg["Subject"] = f"每日代码审查 {datetime.date.today()}"
    msg["From"] = "automation@example.com"
    msg["To"] = RECIPIENT

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(msg)


if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("没有修改的文件，跳过报告。")
        exit(0)

    reviews = {}
    for f in changed[:10]:  # 每次最多处理 10 个文件以控制成本
        diff = get_file_diff(f)
        if diff:
            reviews[f] = review_file(f, diff)

    report = build_report(reviews)
    send_report(report)
    print(f"已为 {len(reviews)} 个文件发送报告。")
```

Crontab 配置：

```bash
0 6 * * 1-5 /usr/bin/python3 /home/user/scripts/daily_code_review.py >> /var/log/code_review.log 2>&1
```

### 每周日志摘要

每周日运行，将一周的应用日志提炼为通俗易懂的摘要：

```bash
#!/bin/bash
# scripts/weekly_log_digest.sh

LOG_FILE="/var/log/myapp/app.log"
OUTPUT_DIR="/var/reports/weekly"
DATE=$(date +%Y-%m-%d)

# 提取过去 7 天的 ERROR/WARN 行
ERRORS=$(grep -E "ERROR|WARN" "$LOG_FILE" | tail -500)

# 构建 prompt 并发送给 OpenClaw
RESPONSE=$(curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg errors "$ERRORS" \
    '{
      model: "llama3.2",
      messages: [{
        role: "user",
        content: ("分析这些过去一周的应用日志错误。按错误类型分组，识别最频繁的问题，并建议根本原因。提供前 5 个问题的编号列表及推荐修复方案。\n\nLogs:\n" + $errors)
      }],
      stream: false
    }'
  )")

echo "$RESPONSE" | jq -r '.message.content' > "$OUTPUT_DIR/digest-$DATE.md"
echo "摘要已保存到 $OUTPUT_DIR/digest-$DATE.md"
```

## 模式二：Webhook 触发工作流

### GitHub Pull Request 自动审查

这是我使用最多的自动化。当我提交 PR 时，webhook 会触发一个小型 Flask 服务器，获取 diff 并通过 OpenClaw 运行审查。

```python
# webhook_server.py
import hmac
import hashlib
import os
import requests
from flask import Flask, request, jsonify
from openclaw_client import query_text

app = Flask(__name__)

GITHUB_SECRET = os.environ["GITHUB_WEBHOOK_SECRET"]
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
MODEL = "codellama:13b"


def verify_github_signature(payload: bytes, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        GITHUB_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_pr_diff(repo: str, pr_number: int) -> str:
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.diff",
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.text[:6000]


def post_pr_comment(repo: str, pr_number: int, body: str):
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {"Authorization": f"Bearer {GITHUB_TOKEN}"}
    requests.post(url, json={"body": body}, headers=headers)


@app.route("/webhook/github", methods=["POST"])
def github_webhook():
    payload = request.get_data()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if not verify_github_signature(payload, sig):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.headers.get("X-GitHub-Event", "")
    data = request.get_json()

    if event == "pull_request" and data.get("action") in ("opened", "synchronize"):
        repo = data["repository"]["full_name"]
        pr_number = data["pull_request"]["number"]
        pr_title = data["pull_request"]["title"]

        diff = get_pr_diff(repo, pr_number)

        review = query_text(
            f"""你是一位资深代码审查员。审查这个标题为"{pr_title}"的 pull request。

关注：
- 正确性和潜在 bug
- 安全漏洞
- 性能问题
- 缺失的测试或边界情况
- 代码清晰度

将审查格式化为带有章节的 markdown。具体、建设性。

Diff:
```
{diff}
```""",
            model=MODEL,
            temperature=0.2,
        )

        comment = f"## AI 代码审查\n\n{review}\n\n*由 OpenClaw ({MODEL}) 生成*"
        post_pr_comment(repo, pr_number, comment)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

将其部署在 nginx 后面，使用 systemd 服务管理，然后在 GitHub 仓库的 Webhook 设置中添加 webhook URL，指向 `https://your-server.com/webhook/github`，选择 PR 事件。

### Slack 消息分发

我有一个 Slack 机器人，监听 `#ai-tasks` 频道的消息并路由给 OpenClaw：

```python
# slack_bot.py
import os
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from openclaw_client import query_text

app = App(token=os.environ["SLACK_BOT_TOKEN"])

@app.message("")
def handle_message(message, say):
    if message.get("bot_id"):
        return  # 忽略机器人消息，防止循环

    user_text = message.get("text", "")
    channel = message["channel"]

    # 立即确认
    say(text="_思考中..._", channel=channel)

    response = query_text(
        user_text,
        model="llama3.2",
        system="你是一个软件开发团队的助手。保持简洁。",
    )

    say(text=response, channel=channel)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
```

## 模式三：批量处理流水线

当需要处理数百个条目时——客户反馈工单、日志条目、文档页面——我会通过受控的批量流水线运行，而不是一次一个地交互查询。关键设计选择是：有界并发以避免压垮 OpenClaw、进度检查点文件使中断的任务可以续跑、以及逐条错误处理使单个失败不影响整体运行。

```python
#!/usr/bin/env python3
# scripts/batch_classify.py
"""使用 OpenClaw 对客户反馈工单进行分类。"""

import json
import csv
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from openclaw_client import query_text

INPUT_CSV = "data/feedback.csv"
OUTPUT_JSONL = "data/classified.jsonl"
CHECKPOINT_FILE = "data/checkpoint.txt"
MAX_WORKERS = 3  # 本地模型的保守并发数
MODEL = "llama3.2"  # 分类任务使用快速模型


def load_checkpoint() -> set[str]:
    path = Path(CHECKPOINT_FILE)
    if path.exists():
        return set(path.read_text().strip().split("\n"))
    return set()


def save_checkpoint(ticket_id: str):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(ticket_id + "\n")


def classify_ticket(ticket: dict) -> dict:
    prompt = f"""将这条客户反馈归类到恰好一个类别。

类别：BUG_REPORT、FEATURE_REQUEST、BILLING_QUESTION、GENERAL_FEEDBACK、URGENT_ISSUE

只用 JSON 回复：{{"category": "...", "priority": "HIGH|MEDIUM|LOW", "summary": "一句话"}}

反馈：{ticket['text']}"""

    response_text = query_text(prompt, model=MODEL, temperature=0.0)

    try:
        classification = json.loads(response_text)
    except json.JSONDecodeError:
        classification = {"category": "PARSE_ERROR", "priority": "LOW", "summary": response_text[:100]}

    return {**ticket, **classification}


def run_batch():
    completed = load_checkpoint()

    with open(INPUT_CSV) as f:
        tickets = list(csv.DictReader(f))

    pending = [t for t in tickets if t["id"] not in completed]
    print(f"处理 {len(pending)} 个工单（{len(completed)} 个已完成）")

    with open(OUTPUT_JSONL, "a") as out_file:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(classify_ticket, t): t for t in pending}

            for future in as_completed(futures):
                ticket = futures[future]
                try:
                    result = future.result()
                    out_file.write(json.dumps(result) + "\n")
                    out_file.flush()
                    save_checkpoint(ticket["id"])
                    print(f"完成：{ticket['id']} → {result.get('category')}")
                except Exception as e:
                    print(f"{ticket['id']} 出错：{e}")


if __name__ == "__main__":
    run_batch()
```

检查点模式对长时间运行的批量任务至关重要。如果 OpenClaw 在第 800 个条目时重启，或网络出现问题，你可以从断点续跑，而不是从头开始。

## 模式四：CI/CD 集成 GitHub Actions

我使用 OpenClaw 对新函数自动生成测试。当 PR 添加了函数但没有对应的测试时，CI 流水线会标记出来，并可选择生成测试骨架。

```yaml
# .github/workflows/ai-review.yml
name: AI 代码审查

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest

    services:
      openclaw:
        image: ollama/ollama:latest
        ports:
          - 11434:11434

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 拉取模型
        run: |
          docker exec $(docker ps -q --filter ancestor=ollama/ollama) \
            ollama pull codellama:7b

      - name: 设置 Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 安装依赖
        run: pip install httpx

      - name: 获取修改的 Python 文件
        id: changed
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '\.py$' > changed_files.txt
          echo "count=$(wc -l < changed_files.txt)" >> $GITHUB_OUTPUT

      - name: 运行 AI 审查
        if: steps.changed.outputs.count > 0
        run: python scripts/ci_review.py changed_files.txt

      - name: 上传审查结果
        uses: actions/upload-artifact@v4
        with:
          name: ai-review
          path: review_output.md
```

配套 Python 脚本：

```python
# scripts/ci_review.py
import sys
import subprocess
from pathlib import Path
from openclaw_client import query_text

def get_diff(filepath: str) -> str:
    result = subprocess.run(
        ["git", "diff", "origin/main...HEAD", "--", filepath],
        capture_output=True, text=True
    )
    return result.stdout[:5000]

def review_for_ci(filepath: str, diff: str) -> str:
    return query_text(
        f"""为 CI 审查这段 Python diff。保持简短和结构化。
只标记：bug、安全问题、缺失的错误处理。
如果没问题，输出："✅ No issues"

File: {filepath}
Diff:
```
{diff}
```""",
        model="codellama:7b",
        temperature=0.1,
    )

def main():
    changed_files_path = sys.argv[1]
    files = Path(changed_files_path).read_text().strip().split("\n")

    output_lines = ["# AI 代码审查\n"]
    has_issues = False

    for f in files:
        if not f:
            continue
        diff = get_diff(f)
        if not diff:
            continue
        review = review_for_ci(f, diff)
        output_lines.append(f"## `{f}`\n{review}\n")
        if "✅" not in review:
            has_issues = True

    Path("review_output.md").write_text("\n".join(output_lines))
    print("\n".join(output_lines))

    if has_issues:
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## 错误处理与可靠性模式

静默失败的自动化比没有自动化更糟糕。以下是我依赖的模式：

**熔断器**：如果 OpenClaw 连续失败 5 次，停止尝试并发出告警。不要让死循环不断轰炸已宕机的服务器。

**死信队列**：重试后仍失败的条目进入单独的文件供人工审查，而不是被丢弃。

**批量任务前的健康检查**：在开始长时间批量运行之前，先 ping `/api/tags` 端点。

```python
import httpx

def health_check() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

if not health_check():
    raise SystemExit("OpenClaw 没有响应。中止批量任务。")
```

**超时策略**：根据模型大小设置每个请求的超时时间。7B 模型对大多数 prompt 应在 60 秒内响应。70B 模型可能需要 3–5 分钟。相应设置超时并记录慢响应。

## 自动化工作流的成本管理

大规模运行自动化需要对成本保持自律——即使是自托管模型，也有真实的 CPU/GPU 时间、电费和硬件损耗成本。

**根据任务复杂度匹配模型。** 我保持一套分级的模型选择策略：

| 任务类型 | 模型 | 理由 |
|---|---|---|
| 分类、打标签 | `llama3.2:3b` | 快速、低成本，对受限任务足够准确 |
| 代码审查、摘要 | `llama3.2`（7B） | 质量与速度的良好平衡 |
| 复杂推理、架构审查 | `codellama:13b` | 高风险任务值得额外时间 |
| 成本敏感的批量处理 | 通过 API 使用 DeepSeek | 详见[DeepSeek 节省成本](/blog/openclaw-deepseek-low-cost) |

**追踪 token 消耗。** OpenClaw 的每个响应都包含 `eval_count`（生成的 token）和 `prompt_eval_count`（prompt 中的 token）。为每个自动化调用记录这些数据：

```python
result = query("...", model="llama3.2")
tokens_in = result.get("prompt_eval_count", 0)
tokens_out = result.get("eval_count", 0)
logger.info(f"tokens_in={tokens_in} tokens_out={tokens_out} model={result['model']}")
```

每周汇总这些日志，你会很快发现哪些任务消耗计算资源最多。我发现我的日志摘要脚本发送的 prompt 有 8,000 个 token，而 2,000 个 token 就完全够用——通过一行日志分析就降低了 75% 的成本。

**设置每次运行的 token 预算上限。** 在批量脚本中，追踪累计 token 用量，超出预算时提前停止：

```python
total_tokens = 0
TOKEN_BUDGET = 100_000  # 超出此值则停止处理

for item in items:
    if total_tokens > TOKEN_BUDGET:
        logger.warning("token 预算已超出，提前停止批量处理")
        break
    result = query(build_prompt(item))
    total_tokens += result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
```

**使用 MCP 服务器减少 prompt 冗余。** 当自动化需要推理代码库时，[自定义 MCP 服务器](/blog/building-custom-mcp-servers-openclaw) 让 OpenClaw 按需拉取上下文，而不是在每个 prompt 中塞入完整文件。精心设计的项目 MCP 服务器，对于代码库感知任务可以减少 60–80% 的 prompt token 用量。

## 综合运用

我当前的自动化栈如下运行：

1. **每天 6 点** — 代码审查 cron 任务扫描昨天的提交，将发现发布到私有 Slack 频道
2. **每次 PR** — GitHub webhook 触发 PR 审查，自动发表评论
3. **周日午夜** — 每周日志摘要 cron 运行，生成 markdown 报告，上传至 S3
4. **持续运行** — `#ai-tasks` 中的 Slack 机器人将消息路由到 OpenClaw 并发布响应
5. **每次 CI 运行** — GitHub Actions 对修改的 Python 文件运行 AI 审查，上传结果制品

整套设置花了大约两个周末构建，现在基本上是零维护。OpenClaw 作为 systemd 服务运行，webhook 服务器在 nginx 后面运行，cron 任务是标准的 crontab 条目。

我想留给你的心智模型：OpenClaw 是一个接受文本、返回文本的 HTTP 服务。在你基础设施中任何调用外部 API 的地方，你都可以改为调用 OpenClaw。从交互用户转变为自动化构建者，主要需要学会编写好的 system prompt，并构建处理重试和成本追踪的脚手架。

从一个 cron 任务开始。构建客户端库。然后第二个自动化的构建速度是第一个的三倍。
