---
title: "オフラインAI：完全なプライバシーを守るためにOllamaでOpenClawを動かす"
description: "OllamaとローカルモデルでOpenClawを完全にオフライン運用する方法。データは一切外部に出ず、APIキーも不要。モデル選択・パフォーマンスチューニング・実践的なユースケースを網羅した完全セットアップガイド。"
publishedAt: 2026-03-20
status: published
visibility: public
---

# オフラインAI：完全なプライバシーを守るためにOllamaでOpenClawを動かす

クラウドAIサービスにメッセージを送った瞬間、そのメッセージはあなたのマシンを離れます。CDNを経由し、プロバイダーによってログに記録され、トレーニングデータとして使用されたり、人間によってレビューされる可能性があります。一般的な用途では許容できるトレードオフかもしれません。しかし、独自のコード・個人データ・機密性の高いビジネスロジック・機密文書を扱う場面では、そうはいきません。

私がローカルAIを調べ始めた理由は明確でした。PII（個人を特定できる情報）を含むカスタマーサポートのチケットを分析するためにAIアシスタントを活用したかったのですが、クラウドAPIを使うとコンプライアンス上の問題が生じる可能性がありました。すべてをローカルで処理することで、その問題をすっきり解決できました。それ以来、ローカル環境を大幅に拡充し、機密性の高いあらゆる作業でメインの環境として使っています。

このガイドでは、Ollamaをモデルバックエンドとして使い、OpenClawを完全にオフラインで動かす方法を解説します。設定が完了すれば、インターネット接続なしで動作し、すべてのデータをローカルで処理し、APIキーを一切必要としないAIアシスタントを手に入れられます。

## なぜOllamaなのか

Ollamaは、大規模言語モデルをローカルで動かすための最もシンプルな方法です。モデルのダウンロード、GGUFフォーマットの変換、ハードウェアアクセラレーションの検出、そしてOpenAIのチャット補完仕様と互換性のあるREST APIを自動的に処理してくれます。最後の点が、特別な統合コードなしにOpenClawと連携できる鍵です。

他の選択肢も存在します。LM Studio、llama.cppの直接利用、LocalAIなど。しかし、Ollamaはシンプルさと機能性のバランスが最も優れています。インストールしてモデルをpullするだけでAPIが立ち上がり、OpenClawはOpenAIへの接続と同じ方法でそのAPIに接続できます。

## システム要件

ローカルモデルには実際の計算能力が必要です。用途別の現実的な最小スペックは以下の通りです。

**基本的な用途（7Bパラメータモデル）：**
- RAM：8GB（GPUがない場合、モデルの一部がRAMで動作）
- GPU VRAM：GPUアクセラレーション用に4GB
- ストレージ：モデル1つあたり5〜10GB

**快適なパフォーマンス（13Bモデル）：**
- RAM：16GB
- GPU VRAM：8GB
- ストレージ：モデル1つあたり8〜15GB

**高品質な出力（30B以上のモデル）：**
- RAM：32GB以上
- GPU VRAM：16GB以上（またはApple Siliconの統合メモリ）
- ストレージ：モデル1つあたり20〜50GB

Apple Silicon Mac（M1/M2/M3/M4）はユニファイドメモリを持ち、ローカルモデルの動作に特に優れています。32GBのユニファイドメモリを搭載したMacBook Proなら、34Bモデルを余裕で動かせます。

## Ollamaのインストール

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: ollama.comからインストーラーをダウンロード

# インストールの確認
ollama --version
```

Ollamaサービスを起動します。

```bash
ollama serve
# macOSではインストール後にメニューバーアプリとして自動起動
```

## モデルの選択

モデルの選択は、このセットアップで最も重要な判断です。大きければいいというわけではありません。GPU VRAMに収まる小さなモデルは、RAMで動作する大きなモデルより大幅に高速です。

**コーディング・技術的なタスクに最適なモデル：**

```bash
# コード特化、技術的な質問に優秀
ollama pull codellama:13b

# Qwen2.5-Coder：コード理解が優秀
ollama pull qwen2.5-coder:14b

# DeepSeek-Coder：コード補完が得意
ollama pull deepseek-coder-v2:16b
```

**文章作成・分析に最適なモデル：**

```bash
# Llama 3.1：このサイズで最良の汎用モデル
ollama pull llama3.1:8b

# Mistral：高速かつ7Bで良質
ollama pull mistral:7b

# Gemma 2：Googleのオープンモデル、推論が得意
ollama pull gemma2:9b
```

**最高品質を目指す大規模モデル：**

```bash
# Llama 3.1 70B（約40GBのRAMまたは24GB以上のVRAMが必要）
ollama pull llama3.1:70b

# Qwen2.5 32B（特定のタスクでは多くの大規模モデルより優秀）
ollama pull qwen2.5:32b
```

OpenClawに接続する前にモデルをテストしてみましょう。

```bash
ollama run mistral:7b "Explain what an MCP server is in one paragraph"
```

これが動作し、レスポンスの品質が許容できるものであれば、接続の準備が整っています。

## OpenClawをOllamaに接続する

OpenClawはOllamaのOpenAI互換APIを通じて接続します。OpenClawの設定ファイルを編集してください。

```yaml
# ~/.openclaw/config.yaml

providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"  # Ollamaは実際のキーを必要としないが、フィールドは必須
    models:
      - id: mistral:7b
        name: "Mistral 7B (Local)"
        contextWindow: 32768
      - id: llama3.1:8b
        name: "Llama 3.1 8B (Local)"
        contextWindow: 131072
      - id: codellama:13b
        name: "CodeLlama 13B (Local)"
        contextWindow: 16384

defaultProvider: ollama-local
defaultModel: mistral:7b
```

OpenClawを再起動して接続を確認します。

```bash
openclaw status
# 表示例: Provider: ollama-local, Model: mistral:7b
```

## オフライン動作の確認

設定が完了したら、インターネットなしで正常に動作するか確認しましょう。

```bash
# ネットワークを無効化（macOS）
networksetup -setnetworkserviceenabled Wi-Fi off

# OpenClawをテスト
openclaw chat "What is 15 * 37?"

# ネットワークを再有効化
networksetup -setnetworkserviceenabled Wi-Fi on
```

ネットワークを無効化した状態でもレスポンスが返ってくるはずです。OpenClawが応答しない、またはエラーになる場合は、Ollamaが引き続き動作しているか確認してください（モデルのダウンロード後、Ollamaはインターネットを必要としないため、動作しているはずです）。

## パフォーマンスのチューニング

ローカルモデルはクラウドAPIより低速です。速度を左右する実際のポイントを紹介します。

**GPUアクセラレーションが最大の要因です。** OllamaがGPUを使用しているか確認してください。

```bash
ollama run mistral:7b "" --verbose
# 確認箇所: "using GPU: NVIDIA GeForce..." または "using Metal: Apple M..."
```

対応GPUがあるのにCPUのみで動作している場合、適切なドライバーをインストールしてください（NVIDIAにはCUDA、AMDにはROCm）。Apple SiliconのmacOSでは、Metalアクセラレーションは自動的に有効になります。

**CPUフォールバック時の並列スレッド数：**

```bash
# Ollamaの環境変数（Linuxでは /etc/ollama/ollama.conf に作成）
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1
```

**コンテキストサイズは速度に大きく影響します。** 7Bモデルで128Kトークンのコンテキストウィンドウは、8Kコンテキストより遅くなります。長いコンテキストが不要な場合は明示的に設定しましょう。

```yaml
# OpenClaw設定
providers:
  - name: ollama-local
    models:
      - id: mistral:7b
        contextWindow: 8192  # コンテキストを小さくすると応答が速くなる
```

**モデルをロードしたままにする。** Ollamaはタイムアウト後にモデルをアンロードします。開発中は常にウォームな状態を保ちましょう。

```bash
# 数分おきにno-opリクエストを送ってモデルをロード状態に保つ
while true; do
  curl -s http://localhost:11434/api/generate \
    -d '{"model":"mistral:7b","prompt":"","keep_alive":"10m"}' > /dev/null
  sleep 300
done
```

## 実践的なユースケース

**独自コードベースのコードレビュー：**

```bash
cd /path/to/private-project
openclaw chat "Review this file for security issues" --files src/auth/jwt.ts
```

データは一切外部に出ません。コード分析のすべてがローカルで完結します。

**機密文書の分析：**

```bash
openclaw chat "Summarize the key obligations in this contract" --files contract.pdf
```

PDF・テキストファイル・コードファイルなど、OpenClawのファイル処理がサポートするあらゆる形式に対応しています。

**インターネット遮断環境での運用：**

インターネットアクセスのない本番環境も存在します。OllamaとOpenClawをインストールし、モデルをダウンロードした後は、エアギャップ環境でもスタック全体が動作します。

**ローカルナレッジベースの検索：**

OpenClawのコンテキストローディングと組み合わせて使えます。

```bash
openclaw chat --context /path/to/internal/docs "How does our payment integration work?"
```

モデルはあなたのローカルドキュメントのみを使って回答します。

## マルチモデルのセットアップ

タスクによって最適なモデルは異なります。OpenClawは会話の途中でモデルを切り替えることができます。

```yaml
# ~/.openclaw/config.yaml
providers:
  - name: ollama-local
    type: openai-compatible
    baseUrl: "http://localhost:11434/v1"
    apiKey: "ollama"
    models:
      - id: mistral:7b
        name: "Fast (Mistral 7B)"
      - id: codellama:13b
        name: "Code (CodeLlama 13B)"
      - id: llama3.1:70b
        name: "Quality (Llama 3.1 70B)"
```

実際には、素早い質問やイテレーションにはMistral 7B、技術的な分析にはCodeLlama、待ち時間を気にしない複雑な推論タスクにはLlama 70Bを使い分けています。

## クラウドとローカルの品質比較

率直な評価をすると、最良のローカルモデル（70B以上）は、複雑なタスクでは最良のクラウドモデル（GPT-4o、Claude 3.5 Sonnet）に近いものの、まだ同等ではありません。2025年にはそのギャップが大幅に縮まりました。多くの実用的なタスクでは：

- **コーディング支援**：ローカル13B以上のモデルは非常に優秀。最も複雑なリファクタリングではクラウドがわずかに優位。
- **テキスト要約**：ローカルモデルは優秀。8B以上では品質差はほぼなし。
- **クリエイティブライティング**：クラウドモデルがまだ優位だが、ローカル70Bも実用に耐える。
- **推論・分析**：新しい複雑な問題にはクラウドが優れている。確立されたパターンにはローカルで十分。

プライバシーが重要な作業では、このような品質のトレードオフは通常許容できます。機密性の低い作業で最高の品質を求めるなら、クラウドAPIが引き続き優れた選択肢です。

## よくある質問

**OllamaモデルでOpenClawのツール利用やMCP機能は使えますか？**

ほとんどのOllamaモデルはファンクションコーリング・ツール利用をサポートしています。互換性はモデルによって異なります。CodeLlama、Llama 3.1、Mistralはよくサポートされています。OllamaのウェブサイトでそのモデルのドキュメントをConfirm。ローカルモデルでMCPサーバーを使用する場合は、モデルが正しくツールを呼び出せるかテストしてください。小さいモデルの中には、複雑なツールスキーマで苦戦するものがあります。

**Ollamaモデルの更新方法は？**

```bash
ollama pull mistral:7b  # 再pullすると最新バージョンを取得
ollama list             # ダウンロード済みモデルの一覧を確認
ollama rm mistral:7b    # ストレージを解放するためにモデルを削除
```

**複数のモデルを同時に実行できますか？**

はい、ただしロードされた各モデルがメモリを占有します。32GBのシステムでは、通常2つの7Bモデルを同時に実行できます。Ollamaの環境変数で `OLLAMA_MAX_LOADED_MODELS=2` を設定してください。

**ローカルモデルでOpenClawのメモリ・セッション永続性は機能しますか？**

はい。OpenClawのセッション管理はモデルバックエンドから独立しています。ローカルセッション、コンテキストローディング、会話履歴はすべてOllamaと同様に機能します。

**量子化について――Q4とQ8はどちらを選ぶべきですか？**

OllamaはデフォルトでQ4_K_M量子化を使用しており、これはバランスの良い選択です。Q8はより高いメモリ使用量を代償により高い品質を提供します。7Bモデルの場合：Q4は約4GB VRAM、Q8は約8GBを使用します。VRAMに余裕があればQ8を推奨します。pullの際に量子化を指定できます。

```bash
ollama pull mistral:7b-instruct-q8_0
```

ここで紹介したオフラインAIのセットアップは、機密性の高い作業での私の標準環境になりました。品質は十分に高く、プライバシーが重要なタスクでクラウドAPIに切り替える必要をほとんど感じません。そしてプライバシーの保証は完璧です。データは一切、決して、マシンの外に出ることはありません。
