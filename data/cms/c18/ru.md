---
title: "Автоматизация OpenClaw: Cron-задачи, Webhook и событийно-управляемые AI-пайплайны"
description: "Используйте API OpenClaw для автоматизации за пределами интерактивного чата: запланированные задачи, Webhook-триггеры, интеграция CI/CD и пайплайны пакетной обработки с реальными примерами кода."
publishedAt: 2026-03-19
status: published
visibility: public
---

# Автоматизация OpenClaw: Cron-задачи, Webhook и событийно-управляемые AI-пайплайны

Большинство разработчиков открывают для себя OpenClaw так же, как и я: устанавливают, открывают терминальный чат-интерфейс и начинают задавать вопросы в интерактивном режиме. Этот сценарий действительно полезен. Но это лишь поверхность.

OpenClaw предоставляет полноценный HTTP API, совместимый со спецификацией OpenAI chat completions. Это означает, что любой скрипт, cron-задача, обработчик webhook или CI/CD-пайплайн, способный выполнять HTTP-запросы, может программно управлять OpenClaw. За последний год я построил слой автоматизации поверх своего самостоятельно размещённого экземпляра OpenClaw, который существенно изменил мой рабочий процесс: ночные отчёты о качестве кода, которые я читаю за утренним кофе; автоматические code review при открытии pull request; Slack-сообщения, отправляющие AI-задачи в очередь; пакетные задания, превращающие тысячи строк логов в полезные дайджесты.

В этой статье я документирую паттерны, которые реально использую в продакшне, с рабочим кодом, который можно адаптировать для своих нужд. Цель — перейти от «я использую OpenClaw для интерактивного чата» к «OpenClaw — часть моей инфраструктуры автоматизации».

## HTTP API OpenClaw

Перед построением автоматизации нужно понять протокол. API-сервер OpenClaw по умолчанию запускается на `localhost:11434`. Основной эндпоинт, который вы будете использовать в автоматизации:

```
POST http://localhost:11434/api/chat
```

Он принимает JSON-тело и возвращает либо полный ответ, либо стриминговый. Минимальная структура:

```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "Изложи в одном предложении: небо синее из-за рассеяния Рэлея."}
    ],
    "stream": false
  }'
```

Ответ в формате JSON:

```json
{
  "model": "llama3.2",
  "created_at": "2026-03-19T08:00:00Z",
  "message": {
    "role": "assistant",
    "content": "Небо выглядит синим, потому что молекулы атмосферы рассеивают более короткие синие волны солнечного света сильнее, чем более длинные красные."
  },
  "done": true,
  "total_duration": 1823456789,
  "eval_count": 38
}
```

Ключевые поля для автоматизации: `message.content` (ответ) и `eval_count` (количество потреблённых токенов — критично для отслеживания затрат). Устанавливайте `"stream": false` в скриптах, где нужен полный ответ перед продолжением. Используйте `"stream": true`, когда вывод направляется в терминал или стриминговый HTTP-обработчик.

Если ваш инструментарий ожидает формат OpenAI, используйте совместимый эндпоинт:

```bash
curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Базовый Python-клиент

Большинство моей автоматизации написано на Python. Вот переиспользуемый клиент, который я использую во всех скриптах:

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
    Отправляет prompt в OpenClaw и возвращает полный словарь ответа.
    Включает экспоненциальную задержку повторных попыток при временных ошибках.
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
            logger.warning(f"Таймаут на попытке {attempt + 1}, повтор через {wait}с")
            time.sleep(wait)
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                wait = 2 ** attempt
                logger.warning(f"Ошибка сервера {e.response.status_code}, повтор через {wait}с")
                time.sleep(wait)
            else:
                raise
        except httpx.ConnectError:
            wait = 2 ** attempt
            logger.warning(f"Соединение отклонено. OpenClaw запущен? Повтор через {wait}с")
            time.sleep(wait)

    raise RuntimeError(f"Запрос к OpenClaw не удался после {max_retries} попыток")


def query_text(prompt: str, **kwargs) -> str:
    """Удобная обёртка, возвращающая только текстовое содержимое."""
    result = query(prompt, **kwargs)
    return result["message"]["content"]
```

Логика повторных попыток важна. В контексте автоматизации OpenClaw может быть кратковременно недоступен во время загрузки модели или перезапуска системы. Экспоненциальная задержка обрабатывает эти временные сбои без ручного вмешательства.

## Паттерн 1: Запланированные Cron-задачи

### Ежедневный отчёт о качестве кода

Запускается каждое утро в 6:00. Собирает все изменённые файлы в основном репозитории за вчера, отправляет их в OpenClaw для быстрого code review и присылает отчёт по email до начала рабочего дня.

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
MODEL = "codellama:13b"  # Специализированная на коде модель для этой задачи

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
    # Обрезаем большие diff, чтобы избежать переполнения токенов
    return result.stdout[:4000]


def review_file(filepath: str, diff: str) -> str:
    prompt = f"""Проверь этот code diff для файла `{filepath}`.
Выяви:
1. Потенциальные баги или логические ошибки
2. Проблемы безопасности (SQL-инъекции, непроверенный ввод и т.д.)
3. Проблемы производительности
4. Отсутствующую обработку ошибок
5. Проблемы стиля кода

Будь лаконичен. Если diff выглядит нормально, скажи «Проблем не обнаружено».

Diff:
```
{diff}
```"""
    return query_text(prompt, model=MODEL, temperature=0.1)


def build_report(reviews: dict[str, str]) -> str:
    lines = [f"# Ежедневный Code Review — {datetime.date.today()}\n"]
    for filepath, review in reviews.items():
        lines.append(f"## `{filepath}`\n")
        lines.append(review)
        lines.append("")
    return "\n".join(lines)


def send_report(report: str):
    msg = MIMEText(report, "plain")
    msg["Subject"] = f"Ежедневный Code Review {datetime.date.today()}"
    msg["From"] = "automation@example.com"
    msg["To"] = RECIPIENT

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(msg)


if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("Изменённых файлов нет, пропускаем отчёт.")
        exit(0)

    reviews = {}
    for f in changed[:10]:  # Максимум 10 файлов за запуск для контроля расходов
        diff = get_file_diff(f)
        if diff:
            reviews[f] = review_file(f, diff)

    report = build_report(reviews)
    send_report(report)
    print(f"Отчёт отправлен для {len(reviews)} файлов.")
```

Запись в crontab:

```bash
0 6 * * 1-5 /usr/bin/python3 /home/user/scripts/daily_code_review.py >> /var/log/code_review.log 2>&1
```

### Еженедельный дайджест логов

Запускается каждое воскресенье и превращает недельные логи приложения в понятную сводку:

```bash
#!/bin/bash
# scripts/weekly_log_digest.sh

LOG_FILE="/var/log/myapp/app.log"
OUTPUT_DIR="/var/reports/weekly"
DATE=$(date +%Y-%m-%d)

# Извлекаем строки ERROR/WARN за последние 7 дней
ERRORS=$(grep -E "ERROR|WARN" "$LOG_FILE" | tail -500)

# Формируем prompt и отправляем в OpenClaw
RESPONSE=$(curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg errors "$ERRORS" \
    '{
      model: "llama3.2",
      messages: [{
        role: "user",
        content: ("Проанализируй ошибки логов приложения за прошедшую неделю. Сгруппируй по типу ошибки, определи наиболее частые проблемы и предложи корневые причины. Предоставь нумерованный список топ-5 проблем с рекомендуемыми исправлениями.\n\nLogs:\n" + $errors)
      }],
      stream: false
    }'
  )")

echo "$RESPONSE" | jq -r '.message.content' > "$OUTPUT_DIR/digest-$DATE.md"
echo "Дайджест сохранён в $OUTPUT_DIR/digest-$DATE.md"
```

## Паттерн 2: Webhook-триггеры

### Автоматический Code Review для GitHub Pull Request

Это моя наиболее используемая автоматизация. Когда я открываю PR, срабатывает webhook, небольшой Flask-сервер получает diff и прогоняет его через OpenClaw.

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
            f"""Ты — опытный code reviewer. Проверь этот pull request с заголовком «{pr_title}».

Обрати внимание на:
- Корректность и потенциальные баги
- Уязвимости безопасности
- Проблемы производительности
- Отсутствующие тесты или крайние случаи
- Ясность кода

Оформи review в виде markdown с разделами. Будь конкретным и конструктивным.

Diff:
```
{diff}
```""",
            model=MODEL,
            temperature=0.2,
        )

        comment = f"## AI Code Review\n\n{review}\n\n*Создано OpenClaw ({MODEL})*"
        post_pr_comment(repo, pr_number, comment)

    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

Разверни за nginx как systemd-сервис, затем добавь URL webhook в настройки Webhooks репозитория GitHub. Укажи `https://your-server.com/webhook/github` с типом контента `application/json` и выбранными событиями PR.

### Диспетчеризация сообщений Slack

У меня есть Slack-бот, который слушает сообщения в канале `#ai-tasks` и маршрутизирует их в OpenClaw:

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
        return  # Игнорируем сообщения ботов для предотвращения петель

    user_text = message.get("text", "")
    channel = message["channel"]

    # Немедленное подтверждение
    say(text="_Думаю..._", channel=channel)

    response = query_text(
        user_text,
        model="llama3.2",
        system="Ты — помощник команды разработчиков программного обеспечения. Будь лаконичен.",
    )

    say(text=response, channel=channel)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
```

## Паттерн 3: Пайплайны пакетной обработки

Когда нужно обработать сотни элементов — тикеты обратной связи от клиентов, записи логов, страницы документации — я запускаю их через контролируемый пакетный пайплайн, а не через последовательные интерактивные запросы. Ключевые решения: ограниченный параллелизм, чтобы не перегружать OpenClaw; файл контрольных точек для возобновления прерванных заданий; обработка ошибок для каждого элемента, чтобы один сбой не убил весь прогон.

```python
#!/usr/bin/env python3
# scripts/batch_classify.py
"""Классификация тикетов обратной связи клиентов с помощью OpenClaw."""

import json
import csv
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from openclaw_client import query_text

INPUT_CSV = "data/feedback.csv"
OUTPUT_JSONL = "data/classified.jsonl"
CHECKPOINT_FILE = "data/checkpoint.txt"
MAX_WORKERS = 3  # Консервативный параллелизм для локальной модели
MODEL = "llama3.2"  # Быстрая модель для задач классификации


def load_checkpoint() -> set[str]:
    path = Path(CHECKPOINT_FILE)
    if path.exists():
        return set(path.read_text().strip().split("\n"))
    return set()


def save_checkpoint(ticket_id: str):
    with open(CHECKPOINT_FILE, "a") as f:
        f.write(ticket_id + "\n")


def classify_ticket(ticket: dict) -> dict:
    prompt = f"""Классифицируй эту обратную связь клиента ровно в одну категорию.

Категории: BUG_REPORT, FEATURE_REQUEST, BILLING_QUESTION, GENERAL_FEEDBACK, URGENT_ISSUE

Отвечай только JSON: {{"category": "...", "priority": "HIGH|MEDIUM|LOW", "summary": "одно предложение"}}

Обратная связь: {ticket['text']}"""

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
    print(f"Обрабатываем {len(pending)} тикетов ({len(completed)} уже завершено)")

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
                    print(f"Готово: {ticket['id']} → {result.get('category')}")
                except Exception as e:
                    print(f"Ошибка при {ticket['id']}: {e}")


if __name__ == "__main__":
    run_batch()
```

Паттерн контрольных точек критически важен для длительных пакетных заданий. Если OpenClaw перезапустится или сеть даст сбой на элементе 800 из 1000, вы возобновите работу с того места, где остановились, а не начнёте сначала.

## Паттерн 4: Интеграция CI/CD с GitHub Actions

Я использую OpenClaw для автоматической генерации тестов к новым функциям. Когда PR добавляет функцию без соответствующих тестов, CI-пайплайн сигнализирует об этом и опционально генерирует скелет теста.

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

      - name: Загрузить модель
        run: |
          docker exec $(docker ps -q --filter ancestor=ollama/ollama) \
            ollama pull codellama:7b

      - name: Настроить Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Установить зависимости
        run: pip install httpx

      - name: Получить изменённые Python-файлы
        id: changed
        run: |
          git diff --name-only origin/${{ github.base_ref }}...HEAD \
            | grep '\.py$' > changed_files.txt
          echo "count=$(wc -l < changed_files.txt)" >> $GITHUB_OUTPUT

      - name: Запустить AI-проверку
        if: steps.changed.outputs.count > 0
        run: python scripts/ci_review.py changed_files.txt

      - name: Загрузить артефакт проверки
        uses: actions/upload-artifact@v4
        with:
          name: ai-review
          path: review_output.md
```

Сопровождающий Python-скрипт:

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
        f"""Проверь этот Python diff для CI. Кратко и структурированно.
Отмечай только: баги, проблемы безопасности, отсутствующую обработку ошибок.
Если всё чисто, выведи: "✅ No issues"

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

    if has_issues:
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Обработка ошибок и паттерны надёжности

Автоматизация, которая молча даёт сбои, хуже отсутствия автоматизации. Паттерны, на которые я полагаюсь:

**Автоматический выключатель (circuit breaker)**: Если OpenClaw даёт сбой 5 раз подряд, прекратить попытки и отправить оповещение. Не давай застрявшему циклу непрерывно атаковать упавший сервер.

**Очередь необработанных сообщений (dead letter queue)**: Элементы, не прошедшие повторные попытки, перемещаются в отдельный файл для ручной проверки, а не удаляются.

**Проверка работоспособности перед пакетными заданиями**: Сделай ping эндпоинта `/api/tags` перед запуском длительного пакетного прогона.

```python
import httpx

def health_check() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False

if not health_check():
    raise SystemExit("OpenClaw не отвечает. Прерываем пакетное задание.")
```

**Стратегия тайм-аутов**: Устанавливай тайм-аут для каждого запроса в зависимости от размера модели. Модель 7B должна отвечать менее чем за 60 секунд для большинства prompt. Модели 70B может понадобиться 3–5 минут. Настраивай тайм-ауты соответственно и логируй медленные ответы.

## Управление затратами для автоматизированных рабочих процессов

Запуск автоматизации в масштабе требует дисциплины в отношении затрат — даже для самостоятельно размещённой модели есть реальные расходы на CPU/GPU-время, электричество и износ оборудования.

**Подбирай модель под сложность задачи.** Я придерживаюсь многоуровневой политики выбора модели:

| Тип задачи | Модель | Обоснование |
|---|---|---|
| Классификация, разметка | `llama3.2:3b` | Быстрая, дешёвая, достаточно точная для ограниченных задач |
| Code review, суммаризация | `llama3.2` (7B) | Хороший баланс качества и скорости |
| Сложные рассуждения, обзор архитектуры | `codellama:13b` | Стоит дополнительного времени для задач с высокими ставками |
| Экономичная массовая обработка | DeepSeek через API | Подробнее в [DeepSeek для экономии](/blog/openclaw-deepseek-low-cost) |

**Отслеживай потребление токенов.** Каждый ответ OpenClaw включает `eval_count` (сгенерированные токены) и `prompt_eval_count` (токены в prompt). Логируй их для каждого автоматизированного вызова:

```python
result = query("...", model="llama3.2")
tokens_in = result.get("prompt_eval_count", 0)
tokens_out = result.get("eval_count", 0)
logger.info(f"tokens_in={tokens_in} tokens_out={tokens_out} model={result['model']}")
```

Агрегируй эти логи еженедельно, и ты быстро увидишь, какие задания потребляют больше всего вычислительных ресурсов. Я обнаружил, что мой скрипт дайджеста логов отправлял prompt на 8000 токенов, когда 2000 было вполне достаточно — 75% экономии от анализа одной строки лога.

**Устанавливай бюджет токенов на запуск.** В пакетных скриптах отслеживай накопленное потребление токенов и останавливайся досрочно, если расходуешь бюджет быстрее ожидаемого:

```python
total_tokens = 0
TOKEN_BUDGET = 100_000  # Остановить обработку при превышении

for item in items:
    if total_tokens > TOKEN_BUDGET:
        logger.warning("Бюджет токенов превышен, досрочно останавливаем пакет")
        break
    result = query(build_prompt(item))
    total_tokens += result.get("eval_count", 0) + result.get("prompt_eval_count", 0)
```

**Используй MCP-серверы для сокращения избыточности prompt.** Когда автоматизации нужно рассуждать о кодовой базе, [кастомные MCP-серверы](/blog/building-custom-mcp-servers-openclaw) позволяют OpenClaw получать контекст по требованию, а не вставлять целые файлы в каждый prompt. Хорошо спроектированный MCP-сервер для твоего проекта может сократить потребление токенов в prompt для задач, осведомлённых о кодовой базе, на 60–80%.

## Собираем всё вместе

Мой текущий стек автоматизации работает так:

1. **Каждый день в 6:00** — cron-задача code review сканирует вчерашние коммиты, публикует результаты в приватный Slack-канал
2. **При каждом PR** — GitHub webhook запускает code review с инлайновыми комментариями
3. **В воскресенье в полночь** — еженедельный cron дайджеста логов, генерирует markdown-отчёт, загружает в S3
4. **Постоянно** — Slack-бот в `#ai-tasks` маршрутизирует сообщения в OpenClaw и публикует ответы
5. **При каждом запуске CI** — GitHub Actions запускает AI-проверку изменённых Python-файлов, публикует артефакт

Настройка заняла около двух выходных и теперь практически не требует обслуживания. OpenClaw работает как systemd-сервис, webhook-сервер — за nginx, cron-задачи — стандартные записи в crontab.

Ментальная модель, которую я хочу оставить тебе: OpenClaw — это HTTP-сервис, принимающий текст и возвращающий текст. В любом месте инфраструктуры, где ты вызываешь внешний API, ты можешь вместо него вызвать OpenClaw. Переход от интерактивного пользователя к строителю автоматизации в основном требует научиться писать хорошие системные prompt и создать скаффолдинг для обработки повторных попыток и отслеживания затрат.

Начни с одной cron-задачи. Создай библиотеку клиента. Тогда вторая автоматизация будет выполнена втрое быстрее первой.
