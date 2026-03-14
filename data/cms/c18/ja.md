---
title: "OpenClaw 自動化：Cron ジョブ、Webhook、イベント駆動型 AI パイプライン"
description: "インタラクティブなチャットを超えて OpenClaw の API を活用した自動化を構築しましょう：定期ジョブ、Webhook トリガーワークフロー、CI/CD 統合、バッチ処理パイプライン。実際のコード例付き。"
publishedAt: 2026-03-19
status: published
visibility: public
---

# OpenClaw 自動化：Cron ジョブ、Webhook、イベント駆動型 AI パイプライン

ほとんどの開発者は私と同じ方法で OpenClaw を発見します。インストールして、ターミナルのチャット画面を開き、インタラクティブに質問を始める。このユースケースは確かに有用です。しかし、それは表面に過ぎません。

OpenClaw は OpenAI の chat completions 仕様と互換性のある完全な HTTP API を公開しています。つまり、HTTP リクエストを送れるあらゆるスクリプト、cron ジョブ、webhook ハンドラー、CI/CD パイプラインが、プログラムから OpenClaw を操作できます。過去 1 年で私はセルフホスト OpenClaw インスタンスの上に自動化の層を積み上げ、作業方法を根本から変えました。毎朝コーヒーを飲みながら読む夜間コード品質レポート、プルリクエストを開くと自動的に実行されるコードレビュー、Slack メッセージが AI タスクをキューに送り込む仕組み、数千行のログを実用的なダイジェストにまとめるバッチジョブ。

この記事では私が実際に本番環境で使っているパターンを、そのまま流用できる実際のコードとともに文書化します。目標は「OpenClaw でインタラクティブチャットをする」から「OpenClaw は自動化インフラの一部だ」という状態に移行することです。

## OpenClaw HTTP API

自動化を構築する前に、ワイヤープロトコルを理解する必要があります。OpenClaw の API サーバーはデフォルトで `localhost:11434` で起動します。自動化で最もよく使うエンドポイントはこちらです：

```
POST http://localhost:11434/api/chat
```

これは JSON ボディを受け取り、完全なレスポンスまたはストリーミングレスポンスを返します。最小構成は以下の通りです：

```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "一文で要約してください：空が青いのはレイリー散乱のためです。"}
    ],
    "stream": false
  }'
```

レスポンス JSON の形式：

```json
{
  "model": "llama3.2",
  "created_at": "2026-03-19T08:00:00Z",
  "message": {
    "role": "assistant",
    "content": "大気中の分子が太陽光の短い青色波長を長い赤色波長よりも強く散乱するため、空は青く見えます。"
  },
  "done": true,
  "total_duration": 1823456789,
  "eval_count": 38
}
```

自動化で重要なフィールドは `message.content`（回答）と `eval_count`（消費トークン数 — コスト追跡に必須）です。次の処理に進む前に完全なレスポンスが必要なスクリプトでは `"stream": false` を設定します。出力をターミナルやストリーミング HTTP ハンドラーにパイプする場合は `"stream": true` を使用します。

ツールが OpenAI 形式を期待している場合は、互換エンドポイントも利用できます：

```bash
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Python クライアント基盤

私の自動化の大部分は Python で書かれています。全スクリプトで再利用しているクライアントラッパーはこちらです：

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
    OpenClaw に prompt を送信し、完全なレスポンスdictを返す。
    一時的なエラーには指数バックオフでリトライする。
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
            logger.warning(f"試行 {attempt + 1} でタイムアウト、{wait}s 後にリトライ")
            time.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"サーバーエラー {e.response.status_code}、{wait}s 後にリトライ")
                time.sleep(wait)
            else:
                raise
        except httpx.ConnectError:
            wait = 2 ** attempt
            logger.warning(f"接続拒否。OpenClaw は起動していますか？{wait}s 後にリトライ")
            time.sleep(wait)

    raise RuntimeError(f"OpenClaw クエリが {max_retries} 回の試行後に失敗しました")


def query_text(prompt: str, **kwargs) -> str:
    """テキストコンテンツのみを返す便利なラッパー。"""
    result = query(prompt, **kwargs)
    return result["message"]["content"]
```

リトライロジックは重要です。自動化コンテキストでは、OpenClaw はモデルのロードやシステム再起動中に一時的に利用不能になることがあります。指数バックオフにより、人手を介さずこれらの一時的な障害に対処できます。

## パターン 1：定期 Cron ジョブ

### 毎日のコード品質レポート

毎朝 6 時に実行します。昨日以降に変更されたすべてのファイルを取得し、OpenClaw に送って簡単な品質レビューを受け、机に座る前にレポートをメールで受け取ります。

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
MODEL = "codellama:13b"  # このタスク用のコード特化モデル

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
    # トークンオーバーランを避けるため大きな diff を切り詰め
    return result.stdout[:4000]


def review_file(filepath: str, diff: str) -> str:
    prompt = f"""ファイル `{filepath}` のこのコード diff をレビューしてください。
以下を特定してください：
1. 潜在的なバグまたはロジックエラー
2. セキュリティ上の懸念（SQL インジェクション、未検証の入力など）
3. パフォーマンスの問題
4. エラーハンドリングの不足
5. コードスタイルの問題

簡潔にしてください。diff が問題なければ「問題なし」と言ってください。

Diff:
```
{diff}
```"""
    return query_text(prompt, model=MODEL, temperature=0.1)


def build_report(reviews: dict[str, str]) -> str:
    lines = [f"# 毎日コードレビュー — {datetime.date.today()}\n"]
    for filepath, review in reviews.items():
        lines.append(f"## `{filepath}`\n")
        lines.append(review)
        lines.append("")
    return "\n".join(lines)


def send_report(report: str):
    msg = MIMEText(report, "plain")
    msg["Subject"] = f"毎日コードレビュー {datetime.date.today()}"
    msg["From"] = "automation@example.com"
    msg["To"] = RECIPIENT

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(msg)


if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("変更ファイルなし、レポートをスキップします。")
        exit(0)

    reviews = {}
    for f in changed[:10]:  # コスト管理のため 1 回の実行で最大 10 ファイル
        diff = get_file_diff(f)
        if diff:
            reviews[f] = review_file(f, diff)

    report = build_report(reviews)
    send_report(report)
    print(f"{len(reviews)} ファイルのレポートを送信しました。")
```

Crontab エントリ：

```bash
0 6 * * 1-5 /usr/bin/python3 /home/user/scripts/daily_code_review.py >> /var/log/code_review.log 2>&1
```

### 週次ログダイジェスト

毎週日曜日に実行し、1 週間のアプリケーションログを平易な言葉の要約に蒸留します：

```bash
#!/bin/bash
# scripts/weekly_log_digest.sh

LOG_FILE="/var/log/myapp/app.log"
OUTPUT_DIR="/var/reports/weekly"
DATE=$(date +%Y-%m-%d)

# 過去 7 日間の ERROR/WARN 行を抽出
ERRORS=$(grep -E "ERROR|WARN" "$LOG_FILE" | tail -500)

# prompt を構築して OpenClaw に送信
RESPONSE=$(curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg errors "$ERRORS" \
    '{
      model: "llama3.2",
      messages: [{
        role: "user",
        content: ("過去 1 週間のこのアプリケーションログエラーを分析してください。エラータイプ別にグループ化し、最も頻繁な問題を特定し、根本原因を提案してください。推奨修正付きの上位 5 件のリストを番号付きで提供してください。\n\nLogs:\n" + $errors)
      }],
      stream: false
    }'
  )")

echo "$RESPONSE" | jq -r '.message.content' > "$OUTPUT_DIR/digest-$DATE.md"
echo "ダイジェストを $OUTPUT_DIR/digest-$DATE.md に保存しました"
```

## パターン 2：Webhook トリガーワークフロー

### GitHub プルリクエスト自動レビュー

これは私が最もよく使う自動化です。PR を開くと webhook が起動し、小さな Flask サーバーが diff を取得して OpenClaw で実行します。

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
            f"""あなたはシニアコードレビュアーです。タイトル「{pr_title}」のプルリクエストをレビューしてください。

以下に注目してください：
- 正確性と潜在的なバグ
- セキュリティの脆弱性
- パフォーマンスの懸念
- テストの欠如やエッジケース
- コードの明確さ

レビューをセクション付きの markdown 形式でフォーマットしてください。具体的かつ建設的に。

Diff:
```
{diff}
```""",
            model=MODEL,
            temperature=0.2,
        )

        comment = f"## AI コードレビュー\n\n{review}\n\n*OpenClaw ({MODEL}) により生成*"
        post_pr_comment(repo, pr_number, comment)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

nginx の後ろに systemd サービスとしてデプロイし、GitHub リポジトリの Webhook 設定に webhook URL を追加します。`https://your-server.com/webhook/github` に PR イベントを選択して設定します。

### Slack メッセージディスパッチ

`#ai-tasks` チャンネルのメッセージを OpenClaw にルーティングする Slack ボットがあります：

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
        return  # ループを防ぐためボットメッセージを無視

    user_text = message.get("text", "")
    channel = message["channel"]

    # 即座に確認
    say(text="_考え中..._", channel=channel)

    response = query_text(
        user_text,
        model="llama3.2",
        system="あなたはソフトウェア開発チームのアシスタントです。簡潔に答えてください。",
    )

    say(text=response, channel=channel)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
```

## パターン 3：バッチ処理パイプライン

数百件のアイテムを処理する必要がある場合（顧客フィードバックチケット、ログエントリ、ドキュメントページなど）、1 件ずつのインタラクティブクエリではなく、制御されたバッチパイプラインで実行します。主要な設計選択は：OpenClaw を圧迫しないための有界並行処理、中断されたジョブを再開できる進捗チェックポイントファイル、1 件の失敗で全体が停止しないための件ごとのエラーハンドリングです。

```python
#!/usr/bin/env python3
# scripts/batch_classify.py
"""OpenClaw を使用して顧客フィードバックチケットを分類する。"""

import json
import csv
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from openclaw_client import query_text

INPUT_CSV = "data/feedback.csv"
OUTPUT_JSONL = "data/classified.jsonl"
CHECKPOINT_FILE = "data/checkpoint.txt"
MAX_WORKERS = 3  # ローカルモデルの保守的な並行数
MODEL = "llama3.2"  # 分類タスク用の高速モデル


def load_checkpoint() -> set[str]:
    path = Path(CHECKPOINT_FILE)
    if path.exists():
        return set(path.read_text().strip().split("\n"))
    return set()


def save_checkpoint(ticket_id: str):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(ticket_id + "\n")


def classify_ticket(ticket: dict) -> dict:
    prompt = f"""この顧客フィードバックをちょうど 1 つのカテゴリに分類してください。

カテゴリ：BUG_REPORT、FEATURE_REQUEST、BILLING_QUESTION、GENERAL_FEEDBACK、URGENT_ISSUE

JSON のみで回答してください：{{"category": "...", "priority": "HIGH|MEDIUM|LOW", "summary": "一文"}}

フィードバック：{ticket['text']}"""

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
    print(f"{len(pending)} 件のチケットを処理します（{len(completed)} 件完了済み）")

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
                    print(f"完了：{ticket['id']} → {result.get('category')}")
                except Exception as e:
                    print(f"{ticket['id']} でエラー：{e}")


if __name__ == "__main__":
    run_batch()
```

チェックポイントパターンは長時間実行のバッチジョブに不可欠です。1000 件中 800 件目で OpenClaw が再起動したりネットワークが不安定になった場合、最初からやり直すのではなく中断したところから再開できます。

## パターン 4：GitHub Actions を使った CI/CD 統合

新しい関数に対して自動テスト生成に OpenClaw を使用しています。PR が対応するテストなしに関数を追加した場合、CI パイプラインがフラグを立て、オプションでテストのスケルトンを生成します。

```yaml
# .github/workflows/ai-review.yml
name: AI コードレビュー

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

      - name: モデルをプル
        run: |
          docker exec $(docker ps -q --filter ancestor=ollama/ollama) \
            ollama pull codellama:7b

      - name: Python のセットアップ
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 依存関係のインストール
        run: pip install httpx

      - name: 変更された Python ファイルを取得
        id: changed
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '\.py$' > changed_files.txt
          echo "count=$(wc -l < changed_files.txt)" >> $GITHUB_OUTPUT

      - name: AI レビューを実行
        if: steps.changed.outputs.count > 0
        run: python scripts/ci_review.py changed_files.txt

      - name: レビュー成果物をアップロード
        uses: actions/upload-artifact@v4
        with:
          name: ai-review
          path: review_output.md
```

配套 Python スクリプト：

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
        f"""CI のためにこの Python の diff をレビューしてください。簡潔で構造化された形式で。
バグ、セキュリティ問題、エラーハンドリングの欠如のみをフラグしてください。
問題がなければ「✅ No issues」と出力してください。

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

    output_lines = ["# AI コードレビュー\n"]
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

## エラーハンドリングと信頼性パターン

サイレントに失敗する自動化は、自動化がない場合より悪いです。私が頼りにしているパターンを紹介します：

**サーキットブレーカー**：OpenClaw が 5 回連続して失敗した場合、試行を停止してアラートを発します。停止したサーバーをループがハンマーしないようにします。

**デッドレターキュー**：リトライ後も失敗したアイテムは、削除されるのではなく、人手によるレビューのために別ファイルに送られます。

**バッチジョブ前のヘルスチェック**：長時間のバッチ実行を開始する前に `/api/tags` エンドポイントに ping します。

```python
import httpx

def health_check() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

if not health_check():
    raise SystemExit("OpenClaw が応答していません。バッチジョブを中止します。")
```

**タイムアウト戦略**：モデルサイズに基づいてリクエストごとのタイムアウトを設定します。7B モデルはほとんどの prompt に 60 秒以内で応答するはずです。70B モデルは 3〜5 分かかることがあります。それに合わせてタイムアウトを設定し、遅いレスポンスをログに記録します。

## 自動化ワークフローのコスト管理

大規模な自動化には、コストに関する規律が必要です。セルフホストモデルでも、CPU/GPU 時間、電気代、ハードウェアの摩耗という実際のコストがあります。

**タスクの複雑さにモデルを合わせる。** 私は段階的なモデル選択ポリシーを維持しています：

| タスクタイプ | モデル | 理由 |
|---|---|---|
| 分類、ラベリング | `llama3.2:3b` | 高速、低コスト、制約タスクに十分な精度 |
| コードレビュー、要約 | `llama3.2`（7B） | 品質とスピードの良いバランス |
| 複雑な推論、アーキテクチャレビュー | `codellama:13b` | ハイステークスタスクには追加時間の価値あり |
| コスト重視の大量処理 | API 経由の DeepSeek | 詳細は[DeepSeek でコスト削減](/blog/openclaw-deepseek-low-cost)を参照 |

**トークン消費を追跡する。** OpenClaw のすべてのレスポンスには `eval_count`（生成トークン）と `prompt_eval_count`（prompt 内トークン）が含まれています。すべての自動化呼び出しでこれらをログに記録します：

```python
result = query("...", model="llama3.2")
tokens_in = result.get("prompt_eval_count", 0)
tokens_out = result.get("eval_count", 0)
logger.info(f"tokens_in={tokens_in} tokens_out={tokens_out} model={result['model']}")
```

これらのログを週次で集計すると、どのジョブが最もコンピュートリソースを消費しているかがすぐにわかります。私はログダイジェストスクリプトが 8,000 トークンの prompt を送っていることを発見しました。2,000 トークンで十分だったのに — 1 行のログ分析から 75% のコスト削減を実現しました。

**実行ごとのトークン予算上限を設定する。** バッチスクリプトで累計トークン使用量を追跡し、予算を超えたら早期停止します：

```python
total_tokens = 0
TOKEN_BUDGET = 100_000  # これを超えたら処理を停止

for item in items:
    if total_tokens > TOKEN_BUDGET:
        logger.warning("トークン予算超過、バッチを早期停止します")
        break
    result = query(build_prompt(item))
    total_tokens += result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
```

**MCP サーバーを使って prompt の冗長性を減らす。** 自動化がコードベースを推論する必要がある場合、[カスタム MCP サーバー](/blog/building-custom-mcp-servers-openclaw)を使うと OpenClaw がオンデマンドでコンテキストを取得でき、すべての prompt にファイル全体を詰め込む必要がなくなります。プロジェクト向けに適切に設計された MCP サーバーは、コードベース対応タスクの prompt トークン使用量を 60〜80% 削減できます。

## すべてをまとめると

私の現在の自動化スタックはこのように動いています：

1. **毎日 6 時** — コードレビュー cron ジョブが昨日のコミットをスキャンし、プライベート Slack チャンネルに投稿
2. **PR ごと** — GitHub webhook が PR レビューをトリガーし、インラインでコメント
3. **日曜深夜** — 週次ログダイジェスト cron が実行し、markdown レポートを生成して S3 にアップロード
4. **継続的** — `#ai-tasks` の Slack ボットがメッセージを OpenClaw にルーティングしてレスポンスを投稿
5. **CI 実行ごと** — GitHub Actions が変更された Python ファイルに AI レビューを実行し、成果物を投稿

セットアップ全体の構築に約 2 週末かかり、現在はほぼゼロメンテナンスです。OpenClaw は systemd サービスとして動作し、webhook サーバーは nginx の後ろで動作し、cron ジョブは標準の crontab エントリです。

残しておきたいメンタルモデル：OpenClaw はテキストを受け取ってテキストを返す HTTP サービスです。インフラ内で外部 API を呼び出す場所はどこでも、代わりに OpenClaw を呼び出せます。インタラクティブユーザーから自動化ビルダーへの移行には、主に良いシステム prompt の書き方と、リトライおよびコスト追跡を処理するスキャフォールディングの構築が必要です。

1 つの cron ジョブから始めてください。クライアントライブラリを構築してください。そうすれば、2 番目の自動化は最初のものより 3 倍速く完成します。
