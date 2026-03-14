---
title: "長時間セッションのための OpenClaw コンテキスト管理最適化"
description: "OpenClaw のコンテキストウィンドウ、メモリ戦略、セッション管理をマスターする。大規模なコードベース、長文書、複数セッションにまたがるプロジェクトでコンテキスト制限に悩まされることなく効率よく作業する方法を解説します。"
publishedAt: 2026-03-22
status: published
visibility: public
---

# 長時間セッションのための OpenClaw コンテキスト管理最適化

コンテキストウィンドウは、AI アシスタントを使う上で最も重要なリソース制約です。現在のタスクについてモデルが把握しているすべての情報——会話履歴、共有したファイル、提供した背景情報——はすべてここに収まらなければなりません。ウィンドウが満杯になると、古い情報は削除され、モデルは会話の流れを見失い始めます。

多くの人が初めてこの制限に直面するのは、大規模なコードベースを扱うタスクです。たくさんのファイルを共有し、複雑なリファクタリングを依頼すると、途中のどこかでモデルが最初に設定した制約を忘れてしまいます。品質が低下し、会話を最初からやり直さなければなりません。

OpenClaw がコンテキストをどのように管理しているかを理解し、その管理と協調して作業することで、フラストレーションの原因だったコンテキスト制限の問題を、解決可能なエンジニアリング上の課題へと変えることができます。

## OpenClaw のコンテキスト処理の仕組み

OpenClaw のコンテキストは、tokens を消費する複数のコンポーネントで構成されています：

1. **システムプロンプト** — モデルの動作を定義する指示（OpenClaw が設定し、設定ファイルで拡張可能）
2. **会話履歴** — 現在のセッション内のすべてのメッセージ
3. **読み込んだファイル** — `--files` またはファイル参照で共有されたファイル
4. **ツール呼び出し結果** — MCP サーバーおよび OpenClaw 組み込みツールからのレスポンス
5. **注入されたコンテキスト** — `--context` で明示的に読み込んだ背景情報

これらの合計がモデルのコンテキストウィンドウに収まる必要があります。クラウドモデルの場合：
- Claude 3.5 Sonnet：200K tokens
- GPT-4o：128K tokens
- Gemini 1.5 Pro：1M tokens（ただしコストが高い）

ローカルモデルの場合：
- 多くの 7B-13B モデル：8K-32K tokens
- Llama 3.1：最大 128K
- Mistral：バージョンによって 32K-64K

tokens の概算：1 token ≈ 英語テキスト 4 文字。典型的な 200 行のコードファイルはおよそ 2,000-4,000 tokens です。

## 現在のコンテキスト使用量を確認する

OpenClaw は複数の方法で token 使用量を表示します：

```bash
# 現在のセッション統計を表示
openclaw status

# 出力例：
# Session: dev-session-001
# Messages: 23
# Tokens used: 47,234 / 200,000 (23.6%)
# Model: claude-3-5-sonnet
# Active files: 4 (12,400 tokens)
```

会話中は、OpenClaw の UI に表示されるコンテキストバーがリアルタイムの使用量を示します。80% に達したら、コンテキスト管理戦略を考え始めましょう。

## 戦略1：ピンポイントなファイル読み込み

最もよくあるミスは、一部分だけ必要なのにファイル全体を読み込んでしまうことです。2,000 行のファイルは 20,000 tokens 以上を消費します。エクスポートの内容を把握したいだけなら、200 tokens で足りるかもしれません。

**特定のセクションだけを読み込む：**

```bash
# ファイル全体を読み込むのは避ける
openclaw chat --files src/api/server.ts "explain the auth middleware"

# より良い方法：具体的に何が必要かを説明する
openclaw chat "Look at src/api/server.ts and explain only the auth middleware section"
```

`--files` で読み込む代わりに、OpenClaw にファイルを「参照」させると、ファイルを読んで必要な部分だけを抽出します。これは多くの場合、token 効率が高い方法です。

**glob パターンを使って関連ファイルだけを読み込む：**

```bash
# 避ける：すべてを読み込んでしまう
openclaw chat --files "src/**/*.ts" "fix the authentication bug"

# より良い：認証関連のファイルだけを読み込む
openclaw chat --files "src/auth/*.ts,src/middleware/auth*.ts" "fix the authentication bug"
```

## 戦略2：続ける前に要約する

長い会話は token の負債を急速に積み上げます。履歴の各メッセージが tokens を消費します。生産的なセッションで問題を解決したあと、次の質問をする前に学んだことを要約しましょう：

```
あなた：「続ける前に、これまでに確認したことを要約しましょう：
- 認証のバグは jwt.ts の 47 行目にある
- 修正方法は署名検証の前にトークンの有効期限を確認すること
- テストファイルは新しい動作に合わせて更新が必要

この文脈を踏まえて、session.ts の関連するセッション期限切れ問題に取り組みましょう」
```

明示的に要約することで、それらの結論に至るまでの長い会話に代わる、コンパクトな参照情報をモデルに提供できます。モデルはすべての過去のメッセージを読み直す必要なく、要約から作業を進められます。

## 戦略3：複数日プロジェクトには命名セッションを使う

OpenClaw のセッションはデフォルトで一時的です。ターミナルを閉じると会話のコンテキストは消えてしまいます。複数日にまたがるプロジェクトには、命名セッションを使いましょう：

```bash
# 命名セッションを開始する
openclaw chat --session my-refactor-project

# 後で再開する
openclaw chat --session my-refactor-project
```

命名セッションは会話履歴をディスクに保存します。しかし永続化しても token バジェットの問題は解決しません——1週間分の会話履歴は膨大になります。解決策は、セッションを集中した作業フェーズに使い、次のフェーズでは新しいセッションを開始することです。

**複数週プロジェクトのセッション作業フロー：**

```
第1週：--session refactor-phase-1
  目標：コードベースを理解し、問題箇所を特定する
  終了時：調査結果を要約し、セッションを閉じる

第2週：--session refactor-phase-2
  開始時：第1週の要約をコンテキストとして読み込む
  目標：特定した問題の修正を実装する
  終了時：変更内容を要約し、セッションを閉じる

第3週：--session refactor-phase-3
  開始時：第2週の要約を読み込む
  目標：テストとエッジケースの対処
```

## 戦略4：背景情報にはコンテキストファイルを使う

多くの会話で役立つ情報——プロジェクトドキュメント、コーディング規約、API スキーマ——には、OpenClaw のコンテキスト読み込み機能を使いましょう：

```bash
# 安定した背景情報を含むコンテキストファイルを作成する
cat > .openclaw-context.md << 'EOF'
# Project Context

This is a Node.js API for a SaaS billing system.
Key constraints:
- Never modify the Stripe webhook handlers without QA sign-off
- All amounts are in cents (no floats for money)
- The legacy V1 API must remain backward compatible
- Use the internal audit logger for all financial operations

Database: PostgreSQL 16
ORM: Drizzle
Auth: JWT with 24h expiry, refresh tokens stored in Redis
EOF

# 各セッションの開始時に読み込む
openclaw chat --context .openclaw-context.md "Let's work on the invoice generation feature"
```

これは毎回の会話でコンテキストを説明し直すよりも効率的です。コンテキストファイルは tokens を消費しますが、コンパクトであり、内容を正確にコントロールできます。

## 戦略5：「ワークスペース」パターン

大規模なコードベース作業には、ワークスペースを定義しましょう：コンテキストバジェットに余裕を持って収まる、最も関連性の高いファイルのキュレーションされたセットです。

```bash
# ワークスペース設定を作成する
cat > .openclaw-workspace.yaml << 'EOF'
name: auth-system
files:
  - src/auth/jwt.ts
  - src/auth/session.ts
  - src/middleware/auth.ts
  - src/models/user.ts
  - tests/auth/*.test.ts
context:
  - docs/auth-architecture.md
EOF

# ワークスペースで作業する
openclaw chat --workspace .openclaw-workspace.yaml "audit the session handling for security issues"
```

ワークスペースはセッションをまたいで一貫性を保ちます。スコープを拡大する必要が生じたら、ワークスペースファイルを更新すればよいだけです。

## 戦略6：段階的な精緻化

長いドキュメントや複雑なタスクでは、一度にすべてをやろうとするのではなく、段階的に進めましょう：

**要約 → アウトライン → ドラフト → 精緻化**

```
パス1：「これら5つのソースファイルを読んで、それぞれがどのように動作するかを1段落で要約してください」
パス2：「それらの要約をもとに、認証フローのリファクタリングアプローチをアウトライン化してください」
パス3：「では、あなたのアウトラインのステップ1を実装しましょう——JWT バリデーションの変更だけ」
パス4：「変更内容を確認してエッジケースをテストしましょう」
```

各パスは前のパスのコンパクトな出力を積み上げます。実装フェーズに入る頃には、コンテキストに抱えているのは完全なファイル内容ではなく、要約だけです。

## 自動化でのコンテキスト監視

OpenClaw の API をスクリプト経由で使う場合は、コンテキスト使用量をプログラムで監視します：

```typescript
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  body: JSON.stringify({
    model: "claude-3-5-sonnet",
    messages: conversationHistory,
  }),
});

const data = await response.json();

// レスポンス内の token 使用量を確認する
const usage = data.usage;
console.log(`Tokens used: ${usage.prompt_tokens} + ${usage.completion_tokens}`);

// 制限に近づいたら要約をトリガーする
if (usage.prompt_tokens > 150000) {
  await summarizeAndCompressHistory(conversationHistory);
}
```

## コンテキストオーバーフローへの対処

あらゆる対策を講じてもコンテキストが満杯になってしまった場合：

**優雅なリカバリーパターン：**

1. モデルに現状を要約させる：「続ける前に、箇条書きで要約してください：(1) 何を達成しようとしていたか、(2) 何を確認したか、(3) 次のステップは何か」
2. 新しいセッションを開始する
3. 要約を開始コンテキストとして読み込む

```bash
# 古いセッションから要約をエクスポートする
openclaw chat --session old-session "summarize our current state for handoff to a new session" > session-handoff.txt

# 引き継ぎ内容で新しいセッションを開始する
openclaw chat --context session-handoff.txt "Continue from the session summary above..."
```

## モデル固有のコンテキスト考慮事項

モデルによって token カウントの特性が異なります：

**Claude モデル**は Anthropic のトークナイザーを使用します。コードは比較的効率的です——Claude はコードの構文をうまく扱うため、他のモデルほどコードファイルが膨らみません。

**GPT モデル**は tiktoken を使用します。英語テキストの効率は同程度ですが、変わった構文のコードでは若干効率が落ちます。

**ローカルモデル**はさまざまです。Llama ベースのモデルは SentencePiece トークナイザーを使用します。専用トークナイザーを持つ一部のクラウドモデルと比べて、アジア系言語のコストが高くなる場合があります。

多言語での作業では、トークナイザーによっては中国語や日本語のテキストが同等の英語テキストの 2-3 倍の tokens を消費する場合があることを覚えておきましょう。最終出力が別の言語であっても、コンテキストファイルや背景情報はできる限り英語で書くことをお勧めします。

## よくある質問

**OpenClaw が会話履歴を削除してしまいました——何が起きたのですか？**

名前のないセッションはデフォルトではディスクに保存されません。`--session session-name` を使って会話を保存してください。保存されたセッションは `~/.openclaw/sessions/` で確認できます。

**コンテキスト制限に近づいていることを知るにはどうすればよいですか？**

OpenClaw は UI にプログレスバーを表示します。API 使用の場合は、レスポンスの `usage.prompt_tokens` フィールドを監視してください。アラート閾値（例：モデルのコンテキストウィンドウの 80%）を設定し、制限に達する前に要約をトリガーしましょう。

**会話をリセットするとコンテキストはクリアされますか？**

はい、チャットで `openclaw clear` または `/clear` を実行すると会話履歴がクリアされます。`--files` で読み込んだファイルと `--context` で読み込んだコンテキストも解放されます。次のメッセージからは白紙の状態で始まります。

**ローカルモデルのコンテキストウィンドウを増やせますか？**

Ollama のコンテキストサイズはモデル読み込み時に設定されます。増やすことは可能ですが、品質とパフォーマンスのトレードオフがあります。モデルの学習済みコンテキスト長（VRAM の制限ではない）を超えると品質が低下します：

```bash
# Ollama のコンテキストサイズを設定する
OLLAMA_NUM_CTX=32768 ollama run mistral:7b
```

品質が許容範囲内に留まることをテストで確認した場合にのみ、モデルのデフォルト値を超えて増やすことを検討してください。

コンテキスト管理は積み重ねで上手くなるスキルです。tokens の仕組みと、それを節約するための戦略を体得すれば、大規模なコードベースでの作業が格段に効率的になります。制限はもはや越えられない壁ではなく、工夫次第で乗り越えられるエンジニアリング上の制約として見えてくるようになります。
