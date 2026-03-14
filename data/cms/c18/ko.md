---
title: "OpenClaw 자동화: Cron 작업, Webhook, 이벤트 기반 AI 파이프라인"
description: "인터랙티브 채팅을 넘어 OpenClaw의 API로 자동화 구축하기: 예약 작업, Webhook 트리거 워크플로우, CI/CD 통합, 배치 처리 파이프라인. 실제 코드 예제 포함."
publishedAt: 2026-03-19
status: published
visibility: public
---

# OpenClaw 자동화: Cron 작업, Webhook, 이벤트 기반 AI 파이프라인

대부분의 개발자는 나처럼 OpenClaw를 발견합니다. 설치하고, 터미널 채팅 인터페이스를 열고, 인터랙티브하게 질문을 시작하는 것이죠. 이 사용 방식은 분명히 유용합니다. 하지만 그것은 표면에 불과합니다.

OpenClaw는 OpenAI의 chat completions 스펙과 호환되는 완전한 HTTP API를 제공합니다. 즉, HTTP 요청을 보낼 수 있는 모든 스크립트, cron 작업, webhook 핸들러, CI/CD 파이프라인이 프로그래밍 방식으로 OpenClaw를 구동할 수 있습니다. 지난 1년 동안 나는 셀프 호스팅 OpenClaw 인스턴스 위에 자동화 레이어를 구축했고, 이것이 내 작업 방식을 의미 있게 바꾸었습니다. 아침 커피를 마시며 읽는 야간 코드 품질 보고서, 풀 리퀘스트를 열면 자동으로 실행되는 코드 리뷰, AI 작업을 큐에 전달하는 Slack 메시지, 수천 줄의 로그를 실행 가능한 요약으로 변환하는 배치 작업.

이 글은 내가 실제로 프로덕션에서 사용하는 패턴을, 바로 적용할 수 있는 실제 코드와 함께 문서화합니다. 목표는 "OpenClaw로 인터랙티브 채팅을 한다"에서 "OpenClaw는 내 자동화 인프라의 일부다"로 이동하는 것입니다.

## OpenClaw HTTP API

자동화를 구축하기 전에 와이어 프로토콜을 이해해야 합니다. OpenClaw의 API 서버는 기본적으로 `localhost:11434`에서 시작합니다. 자동화에서 가장 많이 사용할 엔드포인트는 다음과 같습니다:

```
POST http://localhost:11434/api/chat
```

이것은 JSON 본문을 받아서 완전한 응답이나 스트리밍 응답을 반환합니다. 최소 구조는 다음과 같습니다:

```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "한 문장으로 요약해주세요: 하늘이 파란 이유는 레일리 산란 때문입니다."}
    ],
    "stream": false
  }'
```

응답 JSON 형식:

```json
{
  "model": "llama3.2",
  "created_at": "2026-03-19T08:00:00Z",
  "message": {
    "role": "assistant",
    "content": "대기 중 분자가 태양빛의 짧은 파란색 파장을 긴 빨간색 파장보다 더 강하게 산란시키기 때문에 하늘은 파랗게 보입니다."
  },
  "done": true,
  "total_duration": 1823456789,
  "eval_count": 38
}
```

자동화에서 중요한 필드는 `message.content`(답변)와 `eval_count`(소비된 토큰 수 — 비용 추적에 필수)입니다. 진행하기 전에 완전한 응답이 필요한 스크립트에서는 `"stream": false`를 설정합니다. 출력을 터미널이나 스트리밍 HTTP 핸들러로 파이프할 때는 `"stream": true`를 사용합니다.

기존 OpenAI SDK 클라이언트를 수정 없이 재사용하고 싶다면 호환 엔드포인트도 사용할 수 있습니다:

```bash
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Python 클라이언트 기반

내 자동화의 대부분은 Python으로 작성되어 있습니다. 모든 스크립트에서 재사용하는 클라이언트 래퍼는 다음과 같습니다:

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
    OpenClaw에 prompt를 보내고 완전한 응답 딕셔너리를 반환한다.
    일시적 오류에 대해 지수 백오프 재시도를 포함한다.
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
            logger.warning(f"시도 {attempt + 1}에서 타임아웃, {wait}초 후 재시도")
            time.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"서버 오류 {e.response.status_code}, {wait}초 후 재시도")
                time.sleep(wait)
            else:
                raise
        except httpx.ConnectError:
            wait = 2 ** attempt
            logger.warning(f"연결 거부됨. OpenClaw가 실행 중인가요? {wait}초 후 재시도")
            time.sleep(wait)

    raise RuntimeError(f"OpenClaw 쿼리가 {max_retries}번 시도 후 실패했습니다")


def query_text(prompt: str, **kwargs) -> str:
    """텍스트 내용만 반환하는 편의 래퍼."""
    result = query(prompt, **kwargs)
    return result["message"]["content"]
```

재시도 로직은 중요합니다. 자동화 컨텍스트에서 OpenClaw는 모델 로딩이나 시스템 재시작 중에 잠깐 사용할 수 없을 수 있습니다. 지수 백오프를 통해 수동 개입 없이 이러한 일시적 장애를 처리할 수 있습니다.

## 패턴 1: 예약 Cron 작업

### 일일 코드 품질 보고서

매일 아침 6시에 실행합니다. 어제 이후 수정된 모든 파일을 가져와 OpenClaw에 보내 빠른 품질 검토를 받고, 책상에 앉기 전에 보고서를 이메일로 받습니다.

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
MODEL = "codellama:13b"  # 이 작업을 위한 코드 특화 모델

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
    # 토큰 오버런을 피하기 위해 큰 diff 자르기
    return result.stdout[:4000]


def review_file(filepath: str, diff: str) -> str:
    prompt = f"""파일 `{filepath}`의 이 코드 diff를 리뷰해주세요.
다음을 식별해주세요:
1. 잠재적 버그 또는 로직 오류
2. 보안 우려사항 (SQL 인젝션, 미검증 입력 등)
3. 성능 문제
4. 누락된 에러 처리
5. 코드 스타일 문제

간결하게 해주세요. diff가 괜찮아 보이면 "문제 없음"이라고 말해주세요.

Diff:
```
{diff}
```"""
    return query_text(prompt, model=MODEL, temperature=0.1)


def build_report(reviews: dict[str, str]) -> str:
    lines = [f"# 일일 코드 리뷰 — {datetime.date.today()}\n"]
    for filepath, review in reviews.items():
        lines.append(f"## `{filepath}`\n")
        lines.append(review)
        lines.append("")
    return "\n".join(lines)


def send_report(report: str):
    msg = MIMEText(report, "plain")
    msg["Subject"] = f"일일 코드 리뷰 {datetime.date.today()}"
    msg["From"] = "automation@example.com"
    msg["To"] = RECIPIENT

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(msg)


if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("변경된 파일 없음, 보고서 건너뜀.")
        exit(0)

    reviews = {}
    for f in changed[:10]:  # 비용 관리를 위해 실행당 최대 10개 파일
        diff = get_file_diff(f)
        if diff:
            reviews[f] = review_file(f, diff)

    report = build_report(reviews)
    send_report(report)
    print(f"{len(reviews)}개 파일에 대한 보고서 전송 완료.")
```

Crontab 항목:

```bash
0 6 * * 1-5 /usr/bin/python3 /home/user/scripts/daily_code_review.py >> /var/log/code_review.log 2>&1
```

### 주간 로그 다이제스트

매주 일요일에 실행하여 일주일 치 애플리케이션 로그를 평이한 언어 요약으로 추출합니다:

```bash
#!/bin/bash
# scripts/weekly_log_digest.sh

LOG_FILE="/var/log/myapp/app.log"
OUTPUT_DIR="/var/reports/weekly"
DATE=$(date +%Y-%m-%d)

# 최근 7일간의 ERROR/WARN 줄 추출
ERRORS=$(grep -E "ERROR|WARN" "$LOG_FILE" | tail -500)

# prompt를 만들어 OpenClaw에 전송
RESPONSE=$(curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg errors "$ERRORS" \
    '{
      model: "llama3.2",
      messages: [{
        role: "user",
        content: ("지난 주 이 애플리케이션 로그 오류들을 분석해주세요. 오류 유형별로 그룹화하고, 가장 빈번한 문제를 식별하고, 근본 원인을 제안해주세요. 권장 수정 사항과 함께 상위 5개 문제의 번호 목록을 제공해주세요.\n\nLogs:\n" + $errors)
      }],
      stream: false
    }'
  )")

echo "$RESPONSE" | jq -r '.message.content' > "$OUTPUT_DIR/digest-$DATE.md"
echo "다이제스트가 $OUTPUT_DIR/digest-$DATE.md에 저장되었습니다"
```

## 패턴 2: Webhook 트리거 워크플로우

### GitHub 풀 리퀘스트 자동 리뷰

이것이 내가 가장 많이 사용하는 자동화입니다. PR을 열면 webhook이 발동되어 작은 Flask 서버가 diff를 가져와 OpenClaw로 실행합니다.

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
            f"""당신은 시니어 코드 리뷰어입니다. 제목이 "{pr_title}"인 이 풀 리퀘스트를 리뷰해주세요.

다음에 집중해주세요:
- 정확성과 잠재적 버그
- 보안 취약점
- 성능 우려사항
- 누락된 테스트 또는 엣지 케이스
- 코드 명확성

리뷰를 섹션이 있는 markdown 형식으로 작성해주세요. 구체적이고 건설적으로.

Diff:
```
{diff}
```""",
            model=MODEL,
            temperature=0.2,
        )

        comment = f"## AI 코드 리뷰\n\n{review}\n\n*OpenClaw ({MODEL})로 생성됨*"
        post_pr_comment(repo, pr_number, comment)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

nginx 뒤에 systemd 서비스로 배포하고, GitHub 리포지토리의 Webhook 설정에 webhook URL을 추가합니다. `https://your-server.com/webhook/github`를 가리키고 PR 이벤트를 선택하면 됩니다.

### Slack 메시지 디스패치

`#ai-tasks` 채널의 메시지를 수신하여 OpenClaw로 라우팅하는 Slack 봇이 있습니다:

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
        return  # 루프 방지를 위해 봇 메시지 무시

    user_text = message.get("text", "")
    channel = message["channel"]

    # 즉시 확인
    say(text="_생각 중..._", channel=channel)

    response = query_text(
        user_text,
        model="llama3.2",
        system="당신은 소프트웨어 개발 팀을 위한 도우미입니다. 간결하게 답변해주세요.",
    )

    say(text=response, channel=channel)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
```

## 패턴 3: 배치 처리 파이프라인

수백 개의 항목을 처리해야 할 때 — 고객 피드백 티켓, 로그 항목, 문서 페이지 — 일대일 인터랙티브 쿼리가 아닌 제어된 배치 파이프라인으로 실행합니다. 주요 설계 선택은: OpenClaw를 압도하지 않기 위한 유한 동시성, 중단된 작업을 재개할 수 있는 진행 체크포인트 파일, 하나의 실패가 전체를 죽이지 않도록 항목별 에러 처리입니다.

```python
#!/usr/bin/env python3
# scripts/batch_classify.py
"""OpenClaw를 사용해 고객 피드백 티켓을 분류한다."""

import json
import csv
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from openclaw_client import query_text

INPUT_CSV = "data/feedback.csv"
OUTPUT_JSONL = "data/classified.jsonl"
CHECKPOINT_FILE = "data/checkpoint.txt"
MAX_WORKERS = 3  # 로컬 모델을 위한 보수적인 동시성
MODEL = "llama3.2"  # 분류 작업을 위한 빠른 모델


def load_checkpoint() -> set[str]:
    path = Path(CHECKPOINT_FILE)
    if path.exists():
        return set(path.read_text().strip().split("\n"))
    return set()


def save_checkpoint(ticket_id: str):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(ticket_id + "\n")


def classify_ticket(ticket: dict) -> dict:
    prompt = f"""이 고객 피드백을 정확히 하나의 카테고리로 분류해주세요.

카테고리: BUG_REPORT, FEATURE_REQUEST, BILLING_QUESTION, GENERAL_FEEDBACK, URGENT_ISSUE

JSON만으로 응답하세요: {{"category": "...", "priority": "HIGH|MEDIUM|LOW", "summary": "한 문장"}}

피드백: {ticket['text']}"""

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
    print(f"{len(pending)}개 티켓 처리 중 ({len(completed)}개 완료)")

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
                    print(f"완료: {ticket['id']} → {result.get('category')}")
                except Exception as e:
                    print(f"{ticket['id']} 오류: {e}")


if __name__ == "__main__":
    run_batch()
```

체크포인트 패턴은 장시간 실행되는 배치 작업에 필수적입니다. 1000개 중 800번째에서 OpenClaw가 재시작되거나 네트워크가 불안정해지면, 처음부터 다시 시작하는 것이 아니라 중단된 곳에서 재개할 수 있습니다.

## 패턴 4: GitHub Actions를 사용한 CI/CD 통합

나는 새로운 함수에 대한 자동 테스트 생성에 OpenClaw를 사용합니다. PR이 대응하는 테스트 없이 함수를 추가하면, CI 파이프라인이 이를 표시하고 선택적으로 테스트 스켈레톤을 생성합니다.

```yaml
# .github/workflows/ai-review.yml
name: AI 코드 리뷰

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

      - name: 모델 풀
        run: |
          docker exec $(docker ps -q --filter ancestor=ollama/ollama) \
            ollama pull codellama:7b

      - name: Python 설정
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 의존성 설치
        run: pip install httpx

      - name: 변경된 Python 파일 가져오기
        id: changed
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '\.py$' > changed_files.txt
          echo "count=$(wc -l < changed_files.txt)" >> $GITHUB_OUTPUT

      - name: AI 리뷰 실행
        if: steps.changed.outputs.count > 0
        run: python scripts/ci_review.py changed_files.txt

      - name: 리뷰 결과물 업로드
        uses: actions/upload-artifact@v4
        with:
          name: ai-review
          path: review_output.md
```

동반 Python 스크립트:

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
        f"""CI를 위해 이 Python diff를 리뷰해주세요. 간결하고 구조화된 형태로.
버그, 보안 문제, 누락된 에러 처리만 표시해주세요.
문제가 없으면 "✅ No issues"를 출력하세요.

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

    output_lines = ["# AI 코드 리뷰\n"]
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

## 에러 처리 및 신뢰성 패턴

조용히 실패하는 자동화는 자동화가 없는 것보다 나쁩니다. 내가 의존하는 패턴들을 소개합니다:

**서킷 브레이커**: OpenClaw가 연속으로 5번 실패하면, 시도를 중단하고 알림을 보냅니다. 멈춘 루프가 다운된 서버를 계속 두드리지 않도록 합니다.

**데드 레터 큐**: 재시도 후에도 실패한 항목은 삭제되지 않고 수동 검토를 위한 별도 파일로 이동합니다.

**배치 작업 전 헬스 체크**: 긴 배치 실행을 시작하기 전에 `/api/tags` 엔드포인트를 ping합니다.

```python
import httpx

def health_check() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

if not health_check():
    raise SystemExit("OpenClaw가 응답하지 않습니다. 배치 작업을 중단합니다.")
```

**타임아웃 전략**: 모델 크기에 따라 요청별 타임아웃을 설정합니다. 7B 모델은 대부분의 prompt에 60초 이내로 응답해야 합니다. 70B 모델은 3~5분이 걸릴 수 있습니다. 이에 맞게 타임아웃을 설정하고 느린 응답을 로깅합니다.

## 자동화 워크플로우의 비용 관리

대규모 자동화를 실행하려면 비용에 대한 규율이 필요합니다. 셀프 호스팅 모델도 CPU/GPU 시간, 전기료, 하드웨어 마모라는 실제 비용이 있습니다.

**작업 복잡도에 모델을 맞춘다.** 나는 계층적 모델 선택 정책을 유지합니다:

| 작업 유형 | 모델 | 이유 |
|---|---|---|
| 분류, 레이블링 | `llama3.2:3b` | 빠름, 저렴, 제약된 작업에 충분한 정확도 |
| 코드 리뷰, 요약 | `llama3.2` (7B) | 품질과 속도의 좋은 균형 |
| 복잡한 추론, 아키텍처 리뷰 | `codellama:13b` | 고위험 작업에는 추가 시간 가치 있음 |
| 비용 민감 대량 처리 | API를 통한 DeepSeek | 자세한 내용은 [DeepSeek으로 비용 절감](/blog/openclaw-deepseek-low-cost) 참조 |

**토큰 소비를 추적한다.** OpenClaw의 모든 응답에는 `eval_count`(생성된 토큰)와 `prompt_eval_count`(prompt의 토큰)가 포함됩니다. 모든 자동화 호출에 대해 이것을 로깅합니다:

```python
result = query("...", model="llama3.2")
tokens_in = result.get("prompt_eval_count", 0)
tokens_out = result.get("eval_count", 0)
logger.info(f"tokens_in={tokens_in} tokens_out={tokens_out} model={result['model']}")
```

이 로그를 주간으로 집계하면 어떤 작업이 컴퓨트 리소스를 가장 많이 소비하는지 빠르게 알 수 있습니다. 나는 로그 다이제스트 스크립트가 8,000 토큰 prompt를 보내고 있다는 것을 발견했습니다. 2,000 토큰으로도 충분했는데 — 로그 한 줄 분석으로 75% 비용 절감을 달성했습니다.

**실행별 토큰 예산 한도를 설정한다.** 배치 스크립트에서 누적 토큰 사용량을 추적하고 예산을 초과하면 조기 중단합니다:

```python
total_tokens = 0
TOKEN_BUDGET = 100_000  # 이를 초과하면 처리 중단

for item in items:
    if total_tokens > TOKEN_BUDGET:
        logger.warning("토큰 예산 초과, 배치를 조기 중단합니다")
        break
    result = query(build_prompt(item))
    total_tokens += result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
```

**MCP 서버를 사용해 prompt 장황함을 줄인다.** 자동화가 코드베이스를 추론해야 할 때, [커스텀 MCP 서버](/blog/building-custom-mcp-servers-openclaw)를 통해 OpenClaw가 모든 prompt에 전체 파일을 넣는 대신 필요에 따라 컨텍스트를 가져올 수 있습니다. 프로젝트를 위해 잘 설계된 MCP 서버는 코드베이스 인식 작업의 prompt 토큰 사용량을 60~80% 줄일 수 있습니다.

## 모두 합치기

내 현재 자동화 스택은 다음과 같이 실행됩니다:

1. **매일 6시** — 코드 리뷰 cron 작업이 어제의 커밋을 스캔하고 비공개 Slack 채널에 결과를 게시
2. **모든 PR에서** — GitHub webhook이 PR 리뷰를 트리거하여 인라인 댓글 게시
3. **일요일 자정** — 주간 로그 다이제스트 cron 실행, markdown 보고서 생성, S3 업로드
4. **지속적으로** — `#ai-tasks`의 Slack 봇이 메시지를 OpenClaw로 라우팅하고 응답 게시
5. **모든 CI 실행에서** — GitHub Actions가 변경된 Python 파일에 AI 리뷰 실행, 결과물 게시

전체 설정을 구축하는 데 주말 약 2번이 걸렸으며 현재는 거의 유지 관리가 필요 없습니다. OpenClaw는 systemd 서비스로 실행되고, webhook 서버는 nginx 뒤에서 실행되며, cron 작업은 표준 crontab 항목입니다.

남겨두고 싶은 멘탈 모델: OpenClaw는 텍스트를 받고 텍스트를 반환하는 HTTP 서비스입니다. 인프라에서 외부 API를 호출하는 모든 곳에서 대신 OpenClaw를 호출할 수 있습니다. 인터랙티브 사용자에서 자동화 빌더로의 전환은 주로 좋은 시스템 prompt 작성법을 배우고 재시도 및 비용 추적을 처리하는 스캐폴딩을 구축하는 것을 요구합니다.

하나의 cron 작업으로 시작하세요. 클라이언트 라이브러리를 구축하세요. 그러면 두 번째 자동화는 첫 번째보다 세 배 빠르게 완성됩니다.
