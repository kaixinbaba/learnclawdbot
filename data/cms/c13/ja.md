---
title: "OpenClawで初めての音声AIアシスタントを作ろう"
description: "OpenClaw、Twilio、DeepgramまたはWhisperを使ってJarvis風の音声AIを構築。STT/TTS設定から任意の電話でAIを呼び出すまでの完全チュートリアル。"
publishedAt: 2026-03-14
status: published
visibility: public
---

# OpenClawで初めての音声AIアシスタントを作ろう

どの電話からでもかけられて、何でも聞けて、音声で答えてくれるJarvis風のAIを持つ夢は、何十年もSFの世界のものでした。OpenClaw、Twilio、そして現代の音声認識（STT）・音声合成（TTS）プロバイダーがあれば、これを実際に午後一日で構築できます。

このガイドでは、STT/TTSプロバイダーの設定から電話ブリッジの接続、音声インタラクション向けのアシスタントキャラクター調整まで、完全なセットアップを順を追って解説します。

## 技術スタック

| コンポーネント | 選択肢 |
|---|---|
| **AIゲートウェイ** | OpenClaw（セルフホストまたはクラウド） |
| **電話ブリッジ** | Twilio Voice |
| **STT（音声→テキスト）** | Deepgram Nova-2、OpenAI Whisper |
| **TTS（テキスト→音声）** | ElevenLabs、OpenAI TTS、Google Cloud TTS |
| **AIモデル** | DeepSeek-V3、GPT-4o、Claude、またはOpenClaw対応のあらゆるモデル |

すべてを同時に使う必要はありません。最小構成は **OpenClaw + Twilio + Deepgram（STT）+ OpenAI TTS** です。

## 前提条件

- OpenClawがインストール済みで公開URLからアクセス可能（または[ngrok](https://ngrok.com)でトンネリング）
- 電話番号を持つTwilioアカウント
- DeepgramのAPIキー（またはWhisper用のOpenAI APIキー）
- TTSプロバイダーのAPIキー

## ステップ1：STT/TTSプロバイダーの設定

### オプションA：Deepgram（STTとして推奨）

Deepgram Nova-2は会話的な英語での認識精度が高く低レイテンシ — 電話通話に最適です。

```bash
# OpenClawの.envに追加：
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_MODEL=nova-2
DEEPGRAM_LANGUAGE=en-US
```

### オプションB：OpenAI Whisper

Whisperは汎用目的で最高精度のSTTモデルで、50以上の言語をサポートしています：

```bash
STT_PROVIDER=openai_whisper
OPENAI_API_KEY=your_openai_key_here
WHISPER_MODEL=whisper-1
```

### TTSの設定

音声応答のためにTTSプロバイダーを設定します。ElevenLabsが最も自然な音声を生成します：

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # "Rachel" - 明瞭でプロフェッショナルな声
ELEVENLABS_MODEL=eleven_turbo_v2           # リアルタイム音声向けの低レイテンシモデル
```

またはシンプルなオールインワン構成としてOpenAI TTSを使用：

```bash
TTS_PROVIDER=openai_tts
OPENAI_API_KEY=your_openai_key_here
OPENAI_TTS_VOICE=nova  # 選択肢: alloy, echo, fable, onyx, nova, shimmer
OPENAI_TTS_MODEL=tts-1  # 高品質版はtts-1-hd（レイテンシは高くなる）
```

## ステップ2：Twilioで電話ブリッジを接続する

TwilioはWebhookを使って着信をサーバーに転送します。OpenClawのTwilio Voiceプラグインがこれを自動的に処理します。

### Twilio Voiceプラグインをインストール

OpenClaw Dashboardで：
1. **プラグイン → ブラウズ** に移動
2. 「Twilio Voice」を検索
3. **インストール** をクリックして認証情報を入力：

```bash
# .envに追加：
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

### Twilio Webhookを設定する

Twilioコンソールで：
1. **電話番号 → アクティブな番号** に移動
2. 番号をクリック
3. **Voice & Fax** の下でWebhookを設定：

```
https://your-openclaw-domain.com/api/twilio/voice
```

OpenClawインスタンスがインターネットから公開アクセス可能であることを確認してください。ローカル開発にはngrokを使用：

```bash
ngrok http 3000
# https URLをコピーしてTwilioで使用
```

### 接続をテストする

Twilio番号に電話します。すべて正しく設定されていれば、OpenClawが応答し、あなたの音声をSTTプロバイダーで処理し、テキストをAIモデルに送り、TTSで応答を音声に変換して返します。最初の通話はコールドスタートで2〜3秒かかる場合があります。2回目以降は高速です。

## ステップ3：音声向けにキャラクターをカスタマイズする

テキスト向けのAIプロンプトと音声最適化プロンプトは異なります。音声会話では短い文章・自然な話し言葉・電話という媒体への配慮が必要です。

### 音声システムプロンプトを編集する

OpenClaw Dashboardで **設定 → 音声モード → システムプロンプト** に移動してカスタマイズ：

```
あなたは音声AIアシスタントです。ユーザーはあなたに電話をかけています。

音声応答のルール：
- 回答は簡潔に。詳細を求められない限り、1回の応答につき2〜4文を目安にする。
- 箇条書き、Markdown、リストは使わない — 自然な段落で話す。
- 「もちろん！」「承知しました！」などの余分な言い回しは避ける。
- 知らないことは簡潔に伝え、別の形で助けを申し出る。
- 長い回答が必要な質問には、まず要点をまとめてから詳しく話すか確認する。
- 書類を読み上げるのではなく、友人と話すように自然に話す。

あなたの名前は【アシスタント名】です。頼りになり、的確で、時々機知に富んでいます。
```

### キャラクター調整のヒント

**プロフェッショナルなアシスタント**（仕事、スケジュール管理、メール）：
- 追加：「フォーマルかつ友好的な言葉を使う。スケジュールや重要な詳細については、簡潔さより正確さを優先する。」

**カジュアルな個人アシスタント**（一般的な質問、リマインダー、雑談）：
- 追加：「会話は気軽に。短い返答を好む。自然な話し方で、堅苦しくならないようにする。」

**多言語サポート**：
- 追加：「ユーザーが話している言語を検出し、同じ言語で応答する。」

## 結果：どの電話からでもAIを呼び出せる

すべて設定すると、驚くほど自然な体験が得られます：

1. **あなたが電話する** — 世界中の任意の電話からTwilio番号へ
2. **OpenClawが応答** して録音を開始
3. **あなたが話す** — 質問やコマンドを
4. **Deepgram/Whisperがリアルタイムで** 音声をテキストに変換
5. **AIモデルが** 応答を生成
6. **ElevenLabs/OpenAI TTSが** テキストを音声に変換
7. **あなたが電話で答えを聞く** — エンドツーエンドで通常2〜4秒

Google Searchプラグインで情報を調べたり、カレンダーを管理したり、メッセージを送ったり、ただ会話を楽しんだりできます。世界中のどの電話からでも動作します — 発信者はアプリをインストールする必要も、アカウントを作成する必要もありません。

### 通話例

**スケジュール確認**：「明日の予定は？」 → Google Calendarを読み取って音声で概要を伝える。

**情報検索**：「今週末の東京の天気は？」 → 検索して音声で天気予報を返す。

**操作実行**：「妻に7時に帰るとWhatsAppで送って」 → メッセージを送信して口頭で確認。

## 次のステップ

あなたの音声AIアシスタントが稼働しました。ここから先にできること：

- [OpenClawプラグイン](/blog/openclaw-plugins-productivity)でさらにスキルを追加
- [Raspberry Pi 5](/blog/openclaw-raspberry-pi-5)にデプロイして常時稼働ホームアシスタントに
- より強力なAIモデルに切り替えて深い推論を実現
- 特定のユースケース向けにカスタム電話番号を作成（家族用、仕事用など）

[今すぐOpenClawを始めよう](https://openclaw.dev) — あなたのJarvisが待っています。
