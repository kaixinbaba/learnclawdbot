---
title: "OpenClaw Automation: Cron Jobs, Webhooks, and Event-Driven AI Pipelines"
description: "Use OpenClaw's API for automation beyond interactive chat: scheduled jobs, webhook-triggered workflows, CI/CD integration, and batch processing pipelines with real code examples."
publishedAt: 2026-03-19
status: published
visibility: public
---

# OpenClaw Automation: Cron Jobs, Webhooks, and Event-Driven AI Pipelines

Most developers discover OpenClaw the same way I did: they install it, open the terminal chat interface, and start asking questions interactively. That use case is genuinely useful. But it's only the surface.

OpenClaw exposes a full HTTP API that is compatible with the OpenAI chat completions spec. That means any script, cron job, webhook handler, or CI/CD pipeline that can make an HTTP request can drive OpenClaw programmatically. Over the past year I've built a layer of automation on top of my self-hosted OpenClaw instance that has meaningfully changed how I work: nightly code quality reports that I read with morning coffee, GitHub PR reviews that run automatically when I open a pull request, Slack messages that dispatch AI tasks to a queue, and batch jobs that summarize thousands of log lines into actionable digests.

This article documents the patterns I actually use in production, with real code you can adapt. The goal is to move you from "I use OpenClaw for interactive chat" to "OpenClaw is part of my automation infrastructure."

## The OpenClaw HTTP API

Before building automation, you need to understand the wire protocol. OpenClaw's API server starts on `localhost:11434` by default. The primary endpoint you'll use for automation is:

```
POST http://localhost:11434/api/chat
```

This accepts a JSON body and returns either a complete response or a streaming response. Here's the minimal shape:

```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "Summarize this in one sentence: The sky is blue because of Rayleigh scattering."}
    ],
    "stream": false
  }'
```

The response JSON looks like:

```json
{
  "model": "llama3.2",
  "created_at": "2026-03-19T08:00:00Z",
  "message": {
    "role": "assistant",
    "content": "The sky appears blue because molecules in the atmosphere scatter shorter blue wavelengths of sunlight more than longer red wavelengths."
  },
  "done": true,
  "total_duration": 1823456789,
  "eval_count": 38
}
```

The key fields for automation are `message.content` (the answer) and `eval_count` (tokens consumed — critical for cost tracking). Set `"stream": false` for scripts where you need the full response before proceeding. Use `"stream": true` when you're piping output to a terminal or a streaming HTTP handler.

You can also hit the OpenAI-compatible endpoint if your tooling expects that format:

```bash
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

This is useful when you want to reuse existing OpenAI SDK clients without modification.

## Python Client Foundation

Most of my automation is written in Python. Here's the reusable client I use across all my scripts:

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
    Send a prompt to OpenClaw and return the full response dict.
    Includes exponential backoff retry on transient errors.
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
            logger.warning(f"Timeout on attempt {attempt + 1}, retrying in {wait}s")
            time.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"Server error {e.response.status_code}, retrying in {wait}s")
                time.sleep(wait)
            else:
                raise  # 4xx errors are not retryable
        except httpx.ConnectError:
            wait = 2 ** attempt
            logger.warning(f"Connection refused, is OpenClaw running? Retry in {wait}s")
            time.sleep(wait)

    raise RuntimeError(f"OpenClaw query failed after {max_retries} attempts")


def query_text(prompt: str, **kwargs) -> str:
    """Convenience wrapper that returns just the text content."""
    result = query(prompt, **kwargs)
    return result["message"]["content"]
```

The retry logic matters. In automation contexts, OpenClaw might be briefly unavailable during a model load or system restart. Exponential backoff handles these transient failures without manual intervention.

## Pattern 1: Scheduled Cron Jobs

### Daily Code Quality Report

I run this every morning at 6 AM. It picks up all modified files in my main repo since yesterday, sends them to OpenClaw for a quick quality review, and emails the report to me before I sit down at my desk.

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
MODEL = "codellama:13b"  # Code-focused model for this task

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
    # Truncate large diffs to avoid token overruns
    return result.stdout[:4000]


def review_file(filepath: str, diff: str) -> str:
    prompt = f"""Review this code diff for the file `{filepath}`.
Identify:
1. Potential bugs or logic errors
2. Security concerns (SQL injection, unvalidated input, etc.)
3. Performance issues
4. Missing error handling
5. Code style issues

Be concise. If the diff looks fine, say "No issues found."

Diff:
```
{diff}
```"""
    return query_text(prompt, model=MODEL, temperature=0.1)


def build_report(reviews: dict[str, str]) -> str:
    lines = [f"# Daily Code Review — {datetime.date.today()}\n"]
    for filepath, review in reviews.items():
        lines.append(f"## `{filepath}`\n")
        lines.append(review)
        lines.append("")
    return "\n".join(lines)


def send_report(report: str):
    msg = MIMEText(report, "plain")
    msg["Subject"] = f"Daily Code Review {datetime.date.today()}"
    msg["From"] = "automation@example.com"
    msg["To"] = RECIPIENT

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(msg)


if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("No changed files, skipping report.")
        exit(0)

    reviews = {}
    for f in changed[:10]:  # Cap at 10 files per run to control costs
        diff = get_file_diff(f)
        if diff:
            reviews[f] = review_file(f, diff)

    report = build_report(reviews)
    send_report(report)
    print(f"Report sent for {len(reviews)} files.")
```

Crontab entry:

```bash
0 6 * * 1-5 /usr/bin/python3 /home/user/scripts/daily_code_review.py >> /var/log/code_review.log 2>&1
```

### Weekly Log Digest

This runs every Sunday and distills a week of application logs into a plain-language summary:

```bash
#!/bin/bash
# scripts/weekly_log_digest.sh

LOG_FILE="/var/log/myapp/app.log"
OUTPUT_DIR="/var/reports/weekly"
DATE=$(date +%Y-%m-%d)

# Extract last 7 days of ERROR/WARN lines
ERRORS=$(grep -E "ERROR|WARN" "$LOG_FILE" | tail -500)

# Build a prompt and send to OpenClaw
RESPONSE=$(curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg errors "$ERRORS" \
    '{
      model: "llama3.2",
      messages: [{
        role: "user",
        content: ("Analyze these application log errors from the past week. Group by error type, identify the most frequent issues, and suggest root causes. Provide a numbered list of the top 5 issues with recommended fixes.\n\nLogs:\n" + $errors)
      }],
      stream: false
    }'
  )")

echo "$RESPONSE" | jq -r '.message.content' > "$OUTPUT_DIR/digest-$DATE.md"
echo "Digest saved to $OUTPUT_DIR/digest-$DATE.md"
```

## Pattern 2: Webhook-Triggered Workflows

### GitHub Pull Request Auto-Review

This is my most-used automation. When I open a PR, a webhook fires to a small Flask server that fetches the diff and runs it through OpenClaw.

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
    # Truncate to 6000 chars to stay within context
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
            f"""You are a senior code reviewer. Review this pull request titled "{pr_title}".

Focus on:
- Correctness and potential bugs
- Security vulnerabilities
- Performance concerns
- Missing tests or edge cases
- Code clarity

Format your review as markdown with sections. Be constructive and specific.

Diff:
```
{diff}
```""",
            model=MODEL,
            temperature=0.2,
        )

        comment = f"## AI Code Review\n\n{review}\n\n*Generated by OpenClaw ({MODEL})*"
        post_pr_comment(repo, pr_number, comment)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

Deploy this behind nginx with a systemd service, then add the webhook URL to your GitHub repository settings under Webhooks. Point it at `https://your-server.com/webhook/github` with content type `application/json` and PR events selected.

### Slack Message Dispatch

I have a Slack bot that listens for messages in a `#ai-tasks` channel and routes them to OpenClaw:

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
        return  # Ignore bot messages to prevent loops

    user_text = message.get("text", "")
    channel = message["channel"]

    # Acknowledge immediately
    say(text="_Thinking..._", channel=channel)

    response = query_text(
        user_text,
        model="llama3.2",
        system="You are a helpful assistant for a software development team. Be concise.",
    )

    say(text=response, channel=channel)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
```

## Pattern 3: Batch Processing Pipelines

When I need to process hundreds of items — customer feedback tickets, log entries, documentation pages — I run them through a controlled batch pipeline rather than one-at-a-time interactive queries. The key design choices are: bounded concurrency to avoid overwhelming OpenClaw, a progress checkpoint file so interrupted jobs can resume, and per-item error handling so one bad item doesn't kill the whole run.

```python
#!/usr/bin/env python3
# scripts/batch_classify.py
"""Classify customer feedback tickets using OpenClaw."""

import json
import csv
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from openclaw_client import query_text

INPUT_CSV = "data/feedback.csv"
OUTPUT_JSONL = "data/classified.jsonl"
CHECKPOINT_FILE = "data/checkpoint.txt"
MAX_WORKERS = 3  # Conservative concurrency for local model
MODEL = "llama3.2"  # Fast model for classification tasks


def load_checkpoint() -> set[str]:
    path = Path(CHECKPOINT_FILE)
    if path.exists():
        return set(path.read_text().strip().split("\n"))
    return set()


def save_checkpoint(ticket_id: str):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(ticket_id + "\n")


def classify_ticket(ticket: dict) -> dict:
    prompt = f"""Classify this customer feedback into exactly one category.

Categories: BUG_REPORT, FEATURE_REQUEST, BILLING_QUESTION, GENERAL_FEEDBACK, URGENT_ISSUE

Respond with JSON only: {{"category": "...", "priority": "HIGH|MEDIUM|LOW", "summary": "one sentence"}}

Feedback: {ticket['text']}"""

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
    print(f"Processing {len(pending)} tickets ({len(completed)} already done)")

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
                    print(f"Done: {ticket['id']} → {result.get('category')}")
                except Exception as e:
                    print(f"Error on {ticket['id']}: {e}")


if __name__ == "__main__":
    run_batch()
```

The checkpoint pattern is critical for long-running batch jobs. If OpenClaw restarts or the network hiccups at item 800 of 1000, you resume from where you left off rather than starting over.

## Pattern 4: CI/CD Integration with GitHub Actions

I use OpenClaw for automated test generation on new functions. When a PR adds a function without corresponding tests, the CI pipeline flags it and optionally generates a test skeleton.

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review

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

      - name: Pull model
        run: |
          docker exec $(docker ps -q --filter ancestor=ollama/ollama) \
            ollama pull codellama:7b

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install httpx

      - name: Get changed Python files
        id: changed
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '\.py$' > changed_files.txt
          echo "count=$(wc -l < changed_files.txt)" >> $GITHUB_OUTPUT

      - name: Run AI review
        if: steps.changed.outputs.count > 0
        run: python scripts/ci_review.py changed_files.txt

      - name: Upload review artifact
        uses: actions/upload-artifact@v4
        with:
          name: ai-review
          path: review_output.md
```

The companion Python script:

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
        f"""Review this Python diff for CI. Be brief and structured.
Flag only: bugs, security issues, missing error handling.
If clean, output: "✅ No issues"

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

    output_lines = ["# AI Code Review\n"]
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

    # Non-zero exit makes the CI step fail (optional — configure as warning only)
    if has_issues:
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Error Handling and Reliability Patterns

Automation that silently fails is worse than automation that doesn't exist. Here are the patterns I rely on:

**Circuit breaker**: If OpenClaw fails 5 consecutive times, stop attempting and alert. Don't let a stuck loop hammer a down server.

**Dead letter queue**: Items that fail after retries go to a separate file for manual review rather than being dropped.

**Health check before batch jobs**: Ping the `/api/tags` endpoint before starting a long batch run.

```python
import httpx

def health_check() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

if not health_check():
    raise SystemExit("OpenClaw is not responding. Aborting batch job.")
```

**Timeout strategy**: Set per-request timeouts based on model size. A 7B model should respond in under 60 seconds for most prompts. A 70B model may need 3–5 minutes. Set timeouts accordingly and log slow responses.

## Cost Management for Automated Workflows

Running automation at scale requires discipline around costs — even for a self-hosted model, there are real costs in CPU/GPU time, electricity, and hardware wear.

**Match model to task complexity.** I keep a tiered model selection policy:

| Task Type | Model | Rationale |
|---|---|---|
| Classification, labeling | `llama3.2:3b` | Fast, cheap, accurate enough for constrained tasks |
| Code review, summarization | `llama3.2` (7B) | Good balance of quality and speed |
| Complex reasoning, architecture review | `codellama:13b` | Worth the extra time for high-stakes tasks |
| Cost-sensitive bulk processing | DeepSeek via API | See [DeepSeek for cost savings](/blog/openclaw-deepseek-low-cost) for details |

**Track token consumption.** Every response from OpenClaw includes `eval_count` (tokens generated) and `prompt_eval_count` (tokens in the prompt). Log these for every automated call:

```python
result = query("...", model="llama3.2")
tokens_in = result.get("prompt_eval_count", 0)
tokens_out = result.get("eval_count", 0)
logger.info(f"tokens_in={tokens_in} tokens_out={tokens_out} model={result['model']}")
```

Aggregate these logs weekly and you'll quickly see which jobs consume the most compute. I discovered my log digest script was sending 8,000-token prompts when 2,000 tokens was more than enough — a 75% cost reduction from one log line.

**Cap per-run token budgets.** In batch scripts, track cumulative token usage and stop early if you're burning through a budget faster than expected:

```python
total_tokens = 0
TOKEN_BUDGET = 100_000  # Stop processing if we exceed this

for item in items:
    if total_tokens > TOKEN_BUDGET:
        logger.warning("Token budget exceeded, stopping batch early")
        break
    result = query(build_prompt(item))
    total_tokens += result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
```

**Use MCP servers to reduce prompt verbosity.** When your automation needs to reason about a codebase, [custom MCP servers](/blog/building-custom-mcp-servers-openclaw) let OpenClaw pull context on demand rather than stuffing entire files into every prompt. A well-designed MCP server for your project can cut prompt token usage by 60–80% for codebase-aware tasks.

## Putting It All Together

My current automation stack runs like this:

1. **6 AM daily** — Code review cron job scans yesterday's commits, posts findings to a private Slack channel
2. **On every PR** — GitHub webhook triggers a PR review that comments inline
3. **Sunday midnight** — Weekly log digest cron runs, generates a markdown report, uploads to S3
4. **Continuously** — Slack bot in `#ai-tasks` routes messages to OpenClaw and posts responses
5. **On every CI run** — GitHub Actions runs AI review on changed Python files, posts artifact

The total setup took about two weekends to build and is now essentially zero-maintenance. OpenClaw runs as a systemd service, the webhook server runs behind nginx, and the cron jobs are standard crontab entries.

The mental model I'd leave you with: OpenClaw is an HTTP service that accepts text and returns text. Any place in your infrastructure where you call an external API, you can call OpenClaw instead. The transition from interactive user to automation builder mostly requires learning to write good system prompts and building the scaffolding to handle retries and cost tracking.

Start with one cron job. Build the client library. Then the second automation is three times faster to ship than the first.
