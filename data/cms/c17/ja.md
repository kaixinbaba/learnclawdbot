---
title: "OpenClaw デバッグ完全ガイド：ログ解読、リクエストトレース、根本原因分析"
description: "OpenClaw の問題を体系的に診断するガイド：ログの読み方、リクエストのトレース方法、モデル API エラーの識別、MCP サーバー障害のデバッグ、最も一般的な本番環境の問題の修正方法。"
publishedAt: 2026-03-18
status: published
visibility: public
---

# OpenClaw デバッグ完全ガイド：ログ解読、リクエストトレース、根本原因分析

私は認めたくないほど長い時間を、ターミナルで OpenClaw のログ出力を眺めながら過ごしてきた——たいてい夜 11 時に、ステージング環境では問題なく動いていたデプロイメントがなぜ本番環境でリクエストをサイレントにドロップしているのかを解明しようとして。良いニュースは：どこを見ればよいかさえわかれば、OpenClaw の可観測性はかなりしっかりしているということだ。悪いニュースは：パターンを知らないと、ログはノイズの壁のように感じられるということだ。

このガイドは、私が OpenClaw を本格的にデバッグし始めたとき、最初から持っておきたかったすべてを集めたものだ。ログの読み方、クライアントからモデルバックエンドを経由して戻ってくるリクエストのトレース方法、そして私が最も頻繁に遭遇した障害の診断方法を順を追って説明する。

---

## デバッグモードの有効化

何よりもまず、実際に役立つログが必要だ。OpenClaw のデフォルトのログレベル（`info`）は、何かが起きていることは教えてくれるが、*なぜ* 失敗しているかは教えてくれない。

設定ファイルでログレベルを `debug` に設定する：

```yaml
# openclaw.config.yaml
logging:
  level: debug
  format: json        # 構造化 JSON ——解析がはるかに容易
  output: stdout      # またはファイルパス
  include_request_body: true   # 警告：不注意だとリクエストヘッダーに API キーが記録される
  trace_id: true      # すべてのリクエストにトレース ID を付与
```

設定ファイルに触れたくない場合は、環境変数で設定できる：

```bash
OPENCLAW_LOG_LEVEL=debug OPENCLAW_LOG_FORMAT=json ./openclaw serve
```

`info` と `debug` の出力の差は劇的だ。`info` レベルでは次のように表示される：

```
2026-03-18T09:12:44Z INFO  Request completed status=200 duration=1.2s
```

`debug` レベルでは、モデル選択、トークンカウント、MCP サーバーへのディスパッチ、レスポンスアセンブリを含む完全なリクエストライフサイクルが得られる。それが本物の診断に必要なものだ。

**`include_request_body` に関する重要な注意：** 私は本番環境ではオフにしておき、積極的にデバッグする際にのみ有効にする。リクエストボディにはユーザーメッセージが含まれており、機密データが含まれる可能性がある。一時的に有効にして問題を再現し、その後オフに戻す。

---

## 構造化ログ出力を理解する

`format: json` を設定すると、OpenClaw は構造化 JSON ログを出力する。各ログ行は有効な JSON オブジェクトだ。正常なリクエストサイクルは次のようになる：

```json
{"ts":"2026-03-18T09:12:44.001Z","level":"debug","msg":"Request received","trace_id":"req_a4f9b2","method":"POST","path":"/v1/chat","client_ip":"10.0.1.15"}
{"ts":"2026-03-18T09:12:44.003Z","level":"debug","msg":"Session resolved","trace_id":"req_a4f9b2","session_id":"sess_7c3d1a","context_tokens":4821,"context_limit":128000}
{"ts":"2026-03-18T09:12:44.004Z","level":"debug","msg":"Model selected","trace_id":"req_a4f9b2","model":"deepseek-r1","backend":"deepseek","routing_reason":"default"}
{"ts":"2026-03-18T09:12:44.005Z","level":"debug","msg":"MCP dispatch begin","trace_id":"req_a4f9b2","servers":["filesystem","search"],"tool_calls_pending":0}
{"ts":"2026-03-18T09:12:44.006Z","level":"debug","msg":"Model request sent","trace_id":"req_a4f9b2","backend":"deepseek","prompt_tokens":4821,"temperature":0.7}
{"ts":"2026-03-18T09:12:46.312Z","level":"debug","msg":"Model response received","trace_id":"req_a4f9b2","completion_tokens":387,"finish_reason":"stop","latency_ms":2306}
{"ts":"2026-03-18T09:12:46.313Z","level":"info","msg":"Request completed","trace_id":"req_a4f9b2","status":200,"duration_ms":2312}
```

すべてのログ行は `trace_id`（上記の `req_a4f9b2`）を共有している。これが、単一のリクエストがシステムを通過する様子を追跡するための主要なツールだ。何か問題が起きたとき、trace ID で grep すれば完全な経緯がわかる。

```bash
# 特定のリクエストを追跡
grep "req_a4f9b2" /var/log/openclaw/app.log | jq '.'

# 過去 1 時間の失敗したリクエストをすべて見つける
cat /var/log/openclaw/app.log | jq 'select(.level == "error") | select(.ts > "2026-03-18T08:00:00Z")'

# 遅いリクエスト（5 秒超）を見つける
cat /var/log/openclaw/app.log | jq 'select(.duration_ms > 5000)'
```

`jq` に慣れていなければ、基本的な使い方を学ぶことをお勧めする。構造化ログの分析が苦痛から効率的な作業へと変わる。

---

## 組み込み Trace ビューアーの使用

OpenClaw には Web ベースの trace ビューアーが付属しており、`http://localhost:8080/debug/traces` でアクセスできる（管理インターフェースが有効な場合）。これは、ブラウザのネットワークパネルに似た、リクエストタイミングのウォーターフォールビューを提供する——ただし AI リクエストパイプライン用だ。

有効にする方法：

```yaml
admin:
  enabled: true
  port: 8080
  bind: 127.0.0.1   # 外部に公開しない
  trace_retention: 500   # 最新 500 件のトレースをメモリに保持
```

trace ビューアーは、再現できるレイテンシの問題がある場合に最も役立つ。セッションルックアップ、モデル API 呼び出し、MCP ツール実行、レスポンスストリーミングのどこで時間が費やされているかを正確に確認できる。カスタム MCP サーバーが各呼び出しでコールド DNS ルックアップを行っていたため、すべてのリクエストに 800ms のレイテンシを追加していたケースをこれで発見したことがある——ログのタイムスタンプだけでは明らかでなかったが、ウォーターフォールでは一目瞭然だった。

ビューアーは、保存された任意のトレースの完全なリクエストとレスポンスペイロードも表示するので、`include_request_body` をシステム全体で有効にせずにプロンプト構築のバグを捕捉するのに便利だ。

---

## 障害シナリオ 1：モデル API エラー

最も頻繁に遭遇する障害で、いくつかの明確なカテゴリに分かれる。

### レート制限エラー

ログの特徴：

```json
{"ts":"2026-03-18T10:45:22Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","retry_after":60,"attempt":1}
{"ts":"2026-03-18T10:45:22Z","level":"warn","msg":"Backing off before retry","trace_id":"req_c8e2d1","backoff_ms":5000,"attempt":1}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Model API error","trace_id":"req_c8e2d1","backend":"openai","status":429,"error":"Rate limit exceeded","attempt":2}
{"ts":"2026-03-18T10:45:27Z","level":"error","msg":"Request failed after max retries","trace_id":"req_c8e2d1","attempts":2,"final_status":429}
```

`status: 429` が明確なサインだ。OpenClaw はデフォルトでバックオフしてリトライするが、レート制限に継続的に引っかかる場合、リトライは単に失敗を遅らせるだけだ。

**診断：** 同時に OpenClaw にアクセスしている並行ユーザーや自動化プロセスの数を確認する。レート制限エラーは時間的に集中して現れる——ランダムに分散するのではなく、まとまって発生するのが見えるはずだ。

```bash
# 429 エラーを分単位でカウント
cat /var/log/openclaw/app.log | jq -r 'select(.status == 429) | .ts[0:16]' | sort | uniq -c
```

**修正：** OpenClaw でバックエンド固有のレート制限設定を構成するか、複数の API キーを設定してラウンドロビンルーティングを有効にする：

```yaml
backends:
  openai:
    api_keys:
      - key: sk-key-one
        weight: 1
      - key: sk-key-two
        weight: 1
    rate_limit:
      requests_per_minute: 500
      tokens_per_minute: 90000
```

### 認証失敗

ログの特徴：

```json
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Model API error","trace_id":"req_f1a9c3","backend":"anthropic","status":401,"error":"Invalid API key"}
{"ts":"2026-03-18T11:02:01Z","level":"error","msg":"Authentication failed — check API key config","trace_id":"req_f1a9c3","backend":"anthropic"}
```

401 は明確だ：API キーが間違っているか、期限切れか、欠落している。紛らわしいのは、一部のリクエストは成功して他は失敗する場合——これは通常、複数のバックエンドが設定されていて、そのうちの 1 つに無効なキーがあることを意味する。

**バックエンドを分離する curl テスト：**

```bash
# OpenClaw をバイパスしてモデルバックエンドを直接テスト
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

有効なレスポンスが返ってきたら、キーは問題なく、問題は OpenClaw の設定にある。401 が返ってきたら、問題を発見した。

### コンテキスト長超過

ログの特徴：

```json
{"ts":"2026-03-18T11:15:43Z","level":"error","msg":"Model API error","trace_id":"req_b7d2e4","backend":"deepseek","status":400,"error":"context_length_exceeded","detail":"max_tokens 128000, requested 134521"}
{"ts":"2026-03-18T11:15:43Z","level":"warn","msg":"Context exceeded model limit","trace_id":"req_b7d2e4","context_tokens":134521,"model_limit":128000,"session_id":"sess_9a4b7c"}
```

これは微妙だ。個々のリクエストサイズではなく、セッションの長さと相関している。しばらく続いている会話はモデルの制限に達するまでコンテキストを積み上げていく。

**診断：** 同じ `session_id` のリクエスト間で `context_tokens` フィールドを確認する。モデルの制限に近づいているのが見えたら、もうすぐ失敗する。

**修正：** セッション設定で自動コンテキスト切り捨てまたは要約を有効にする：

```yaml
sessions:
  context_management:
    strategy: truncate_oldest    # または要約モデルが設定されている場合は "summarize"
    max_context_tokens: 120000   # モデルの実際の制限より下にバッファを残す
    warn_at_tokens: 100000
```

---

## 障害シナリオ 2：MCP サーバー接続失敗

カスタム MCP サーバーを実行している場合（[MCP サーバーガイド](/blog/building-custom-mcp-servers-openclaw) を参照）、いつかは障害に遭遇する。症状はさまざまだ：実行されないツール、サイレントタイムアウト、または「ツール利用不可」としてユーザーに浮上するエラー。

### 接続拒否

ログの特徴：

```json
{"ts":"2026-03-18T12:30:15Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":1}
{"ts":"2026-03-18T12:30:15Z","level":"warn","msg":"MCP server marked unhealthy","server":"my-custom-tools","consecutive_failures":1}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server connection failed","trace_id":"req_e5c1f8","server":"my-custom-tools","error":"connect ECONNREFUSED 127.0.0.1:9001","attempt":2}
{"ts":"2026-03-18T12:30:45Z","level":"error","msg":"MCP server unavailable — tool calls will fail","server":"my-custom-tools","consecutive_failures":2}
```

`ECONNREFUSED` は、設定されたポートでプロセスが実行されていないか、別のポートでリッスンしていることを意味する。まず確認すること：

```bash
# MCP サーバープロセスは実行中か？
ps aux | grep my-custom-tools

# 期待されるポートでリッスンしているものがあるか？
lsof -i :9001

# OpenClaw からアクセスできるか？（同じホストから）
curl -v http://127.0.0.1:9001/health
```

### MCP プロトコルエラー

診断が難しい。MCP サーバープロセスは実行中だが、不正なレスポンスを返している場合に発生する：

```json
{"ts":"2026-03-18T13:05:22Z","level":"error","msg":"MCP protocol error","trace_id":"req_d4a7b9","server":"filesystem","error":"invalid JSON in response","raw_response":"<html>404 Not Found</html>"}
{"ts":"2026-03-18T13:05:22Z","level":"debug","msg":"MCP server response dump","server":"filesystem","response_bytes":27,"content_type":"text/html"}
```

`raw_response` フィールドがサーバーの実際の返答を教えてくれる。JSON フィールド内に HTML 404 ページがあるのは、エンドポイント URL の設定が間違っていることを意味する——おそらく MCP サーバーに直接ではなく、nginx プロキシにアクセスしている。

```bash
# MCP サーバーのツールリストを直接テスト
curl -X POST http://127.0.0.1:9001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

健全な MCP サーバーはツール定義を含む JSON-RPC レスポンスを返す。それ以外はサーバーレベルの問題を示している。

### MCP タイムアウト

```json
{"ts":"2026-03-18T13:45:01Z","level":"warn","msg":"MCP tool call timed out","trace_id":"req_a2c8d5","server":"search","tool":"web_search","timeout_ms":10000,"elapsed_ms":10003}
{"ts":"2026-03-18T13:45:01Z","level":"error","msg":"Tool call failed","trace_id":"req_a2c8d5","server":"search","tool":"web_search","error":"timeout"}
```

ツール呼び出しが設定されたタイムアウトに達した。これは通常、MCP サーバーが何か時間のかかることをしていることを意味する——外部 HTTP 呼び出し、データベースクエリ、または単純に過負荷。

**修正：** その操作が本質的に遅い場合はそのサーバーのタイムアウトを増やし、ハングするのではなく速やかに失敗するように MCP サーバー内部にタイムアウトを追加する：

```yaml
mcp_servers:
  search:
    url: http://localhost:9002
    timeout_ms: 30000    # デフォルトの 10s から増加
    retry:
      attempts: 2
      delay_ms: 1000
```

---

## 障害シナリオ 3：ストリーミング中の WebSocket 切断

WebSocket 経由でのレスポンスストリーミングは、特に高負荷時に予測不可能になりやすい。失敗モードは通常、クライアントがレスポンスの途中で接続が切れるのを見るというもので、エラーなしにメッセージが途中で終わる形で現れる。

サーバー側のログの特徴：

```json
{"ts":"2026-03-18T14:20:33Z","level":"debug","msg":"WebSocket stream started","trace_id":"req_g9h1i2","client_ip":"10.0.1.22","session_id":"sess_3e7f2b"}
{"ts":"2026-03-18T14:20:41Z","level":"warn","msg":"WebSocket write error","trace_id":"req_g9h1i2","error":"write: broken pipe","bytes_sent":12840,"completion_pct":67}
{"ts":"2026-03-18T14:20:41Z","level":"info","msg":"WebSocket connection closed (client disconnect)","trace_id":"req_g9h1i2","clean_close":false}
```

`broken pipe` と `clean_close: false` は、クライアントが接続を切ったことを告げている——OpenClaw が閉じたのではない。よくある原因：

**ロードバランサーのタイムアウト：** ロードバランサーのタイムアウトが OpenClaw のストリーム時間より短い。ロードバランサーのアイドル接続タイムアウトを確認する。nginx の場合：

```nginx
proxy_read_timeout 120s;    # 最も長い期待レスポンス時間より長くする必要がある
proxy_send_timeout 120s;
```

**クライアント側タイムアウト：** ブラウザまたはクライアントアプリのリクエストタイムアウトがストリーム完了前に発火する。あまり一般的ではないが、起こる。

**ネットワークの不安定性：** broken pipe エラーが特定の時間に集中して現れる場合、ネットワーク監視データと関連付けて分析する。

クライアントの切断とサーバー側エラーを区別するには、`clean_close` を確認する。それが `false` で OpenClaw からの先行エラーがない場合、クライアントが接続を諦めた。接続クローズの前にモデルエラーや OOM イベントがある場合は、サーバーが原因だ。

---

## 障害シナリオ 4：高レイテンシ

高レイテンシは最もイライラする障害だ。システムは技術的には動作している——ただ遅いだけ。trace ビューアーがここで大いに役立つが、ログだけでも分析できる。

モデル自体は速かったが MCP が遅かった高レイテンシリクエスト：

```json
{"ts":"2026-03-18T15:10:01Z","level":"debug","msg":"Model request sent","trace_id":"req_k3l5m7","latency_checkpoint":"model_start"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"Model response received","trace_id":"req_k3l5m7","latency_ms":2100,"latency_checkpoint":"model_end"}
{"ts":"2026-03-18T15:10:03Z","level":"debug","msg":"MCP tool call begin","trace_id":"req_k3l5m7","server":"database","tool":"query_records"}
{"ts":"2026-03-18T15:10:11Z","level":"debug","msg":"MCP tool call complete","trace_id":"req_k3l5m7","server":"database","tool":"query_records","latency_ms":8200}
{"ts":"2026-03-18T15:10:11Z","level":"info","msg":"Request completed","trace_id":"req_k3l5m7","duration_ms":10350}
```

モデルに 2.1 秒。データベース MCP ツールに 8.2 秒。合計：10.35 秒。セグメントごとのタイミングがあれば、ボトルネックは明らかだ。

私が見てきた他の高レイテンシの原因：
- **セッションデシリアライゼーション：** 大きなコンテキストを持つセッションが毎リクエスト Redis から読み込まれる。修正：シリアライゼーション形式を確認し、デシリアライズされたセッションをメモリにキャッシュすることを検討する。
- **モデルルーティングのコールドスタート：** バックエンドへの最初のリクエストは接続プールのウォームアップ中に時間がかかる。修正：keepalive 接続を設定する。
- **高負荷下のキューイング：** リクエストが他のリクエストの後ろで待機する。修正：ワーカーを増やすか水平スケーリングする。ログに高い `queue_wait_ms` として現れる。

[DeepSeek でローカルルーティングを使用している場合](/blog/openclaw-deepseek-low-cost)、高レイテンシは多くの場合、推論ノードが GPU メモリ圧力下にあることを意味する——`nvidia-smi` または同等のメトリクスを OpenClaw のタイミングデータと関連付けて確認する。

---

## 障害シナリオ 5：メモリとセッションの問題

OpenClaw のセッションは比較的軽量だが、大きなコンテキストを持つ長期実行セッションがあると、メモリが問題になることがある。

セッションメモリ圧力のサイン：

```json
{"ts":"2026-03-18T16:00:02Z","level":"warn","msg":"Session store near capacity","active_sessions":4821,"max_sessions":5000,"memory_mb":1840}
{"ts":"2026-03-18T16:00:15Z","level":"error","msg":"Session evicted under memory pressure","session_id":"sess_8b2e9d","age_minutes":47,"context_tokens":98000}
{"ts":"2026-03-18T16:00:15Z","level":"warn","msg":"Client will receive session expired error","session_id":"sess_8b2e9d"}
```

セッションが退避されることは、そのユーザーの次のリクエストが新しい会話として現れることを意味する——履歴が消えてしまう。これはユーザーにとって混乱を招き、セッション容量が低すぎるか、セッションが保持するコンテキストが多すぎるサインだ。

**修正：** セッションごとのコンテキスト制限を下げ、退避されたセッションを復元できるように Redis 永続化を有効にするか、メモリ制限を増やす：

```yaml
sessions:
  max_active: 10000
  store: redis              # 永続的、メモリ圧力を回避
  redis_url: redis://localhost:6379
  max_context_tokens: 50000  # セッションごとのより積極的な制限
  idle_timeout_minutes: 60   # アイドルセッションをより早く退避
```

---

## 体系的なトラブルシューティングチェックリスト

新しいバグレポートを受け取ったとき、私はこの順序で対処する：

1. **trace ID を取得する。** ユーザーが障害を報告した場合、OpenClaw がレスポンスに `X-Trace-Id` ヘッダーを返しているか確認する。あれば、すぐに grep する。

2. **ログレベルを確認する。** `info` レベルなら、一時的に `debug` に上げて問題を再現する。見えないものは診断できない。

3. **エラーログから障害タイプを特定する。** モデル API からの 4xx か？MCP サーバーからの接続エラーか？プロトコルレベルの切断か？

4. **モデルバックエンドを分離する。** curl を使ってモデル API を直接テストする（上記の 401 セクション参照）。OpenClaw とバックエンドのどちらが問題かがわかる。

5. **MCP サーバーを分離する。** MCP ツール呼び出しが関係している場合、curl を使って各 MCP サーバーを直接テストする。健全なサーバーは `tools/list` 呼び出しに正しく応答する。

6. **タイミングを確認する。** レイテンシが問題の場合、trace ビューアーか `jq` を使ってセグメントごとのタイミングを比較する。時間が実際にどこで費やされているかを見つける。

7. **セッション状態を確認する。** ユーザーが会話履歴を失ったり、予期しないリセットを経験している場合、セッション退避の警告を探し、セッションストアの健全性を確認する。

8. **リソース使用率を確認する。** OOM キル、CPU スパイク、GPU メモリ圧力はすべてカスケード障害を引き起こす。システムメトリクスとログの障害タイミングを関連付けて分析する。

9. **最近の設定変更を確認する。** 私が調査した本番障害のほとんどは、些細に見えた設定変更に遡ることができる。設定ファイルの git diff を確認する。

10. **隔離環境で再現する。** 修正を書く前に、問題を一貫して再現できることを確認する。curl またはシンプルなスクリプトを使って、失敗している正確なリクエストを発火させる。

---

## クイックリファレンス：ログパターンとその意味

| ログメッセージ | 考えられる原因 |
|---|---|
| `status: 429` | モデル API のレート制限 |
| `status: 401` | 無効または欠落している API キー |
| `context_length_exceeded` | セッションコンテキストがモデルの制限を超えている |
| `connect ECONNREFUSED` | MCP サーバーが実行されていない |
| `invalid JSON in response` | MCP サーバーのエンドポイント URL が間違っている |
| `write: broken pipe` | クライアントが接続を切った（ロードバランサーのタイムアウトを確認） |
| `clean_close: false` | WebSocket の異常終了 |
| `Session evicted` | セッションストアが容量に達した |
| `queue_wait_ms > 1000` | ワーカープールが飽和、より多くの容量が必要 |

---

## おわりに

分散システムのデバッグが完全に体系的になることはない——理解できないログ行や、3 つのことを同時に見るまで意味がわからないタイミングの問題は常に存在する。しかし OpenClaw のロギングインフラは、ほとんどの障害の根本原因を英雄的な努力なしに見つけるのに十分なシグナルを提供してくれる。

私が最も時間を節約できた習慣：本番環境では常に構造化 JSON ログを使用すること、常に最初に `trace_id` を確認すること、そして OpenClaw のルーティングロジックを責める前にモデルバックエンドと MCP サーバーを隔離してテストすること。ほとんどの場合、問題は見た目より単純で、最初の `jq` クエリで見つかる。

カスタム MCP サーバーを構築していて原因不明の障害に遭遇している場合は、[MCP サーバーガイド](/blog/building-custom-mcp-servers-openclaw) で最も多くの人が躓くプロトコルレベルの詳細をカバーしている。モデルバックエンドが DeepSeek で予期しないレイテンシが発生している場合は、[DeepSeek セットアップガイド](/blog/openclaw-deepseek-low-cost) で役立つ推論側のチューニングをカバーしている。

健闘を祈る。あなたの `trace_id` が常に有用な場所へ導いてくれることを。
