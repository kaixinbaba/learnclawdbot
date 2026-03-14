---
title: "OpenClaw + Home Assistant：AIによるスマートホーム制御"
description: "OpenClawをHome Assistantに接続して、自然言語でスマートホームを操作しましょう。Home Assistant MCPサーバーを使ったステップバイステップのセットアップガイドと、実際のオートメーション例および音声コマンドのパターンを紹介します。"
publishedAt: 2026-03-21
status: published
visibility: public
---

# OpenClaw + Home Assistant：AIによるスマートホーム制御

スマートホームの自動化といえば、従来はオートメーションを記述する方法が一般的でした。「日没時に誰かが家にいればリビングの照明をつける」「平日の朝7時にドアが開いたらコーヒーメーカーを起動する」といった具合です。これらは確かに機能しますが、事前にシナリオを想定し、正確な条件をコードに落とし込む必要があります。

私が求めていたのは別のアプローチでした。「少し暑いな、もう少し快適にしてくれ」と一言言えば、AIがどのエンティティをどの程度、どの順番で変更すべきかを判断してくれる——そんな操作感です。これは根本的に異なるインタラクションモデルであり、驚くほどうまく機能します。

このガイドでは、HA MCPサーバーを使ってOpenClawをHome Assistantに接続する方法を解説します。設定が完了すれば、自然言語の会話でスマートホームを制御したり、OpenClawにオートメーションを作成させたり、デバイスの問題を診断したり、家の状態を問い合わせたりできるようになります。

## アーキテクチャの概要

この統合は3つのコンポーネントで構成されます。

1. **Home Assistant** — 既存のHAインストール（2024以降の任意バージョン）
2. **Home Assistant MCPサーバー** — HAのAPIをMCPツールとして公開するブリッジ
3. **OpenClaw** — リクエストに基づいてそれらのツールを呼び出すAI

「寝室の照明をすべて消して」と指示すると、OpenClawはそれをモデルに送信し、モデルは `call_service` ツールに `light.turn_off` と寝室のエンティティIDを渡して呼び出すことを決定し、MCPサーバーがHAに対してそのサービス呼び出しを実行し、HAが照明を消します。

シンプルなコマンドの場合、入力から実行までの往復時間は通常1〜3秒です。

## 前提条件

- Home Assistantのインストールと起動（HA OS、Supervised、Container、またはCore）
- HAの長期アクセストークン（Long-Lived Access Token）
- OpenClawのインストール
- Node.js 20以上

## Home Assistantのアクセストークンを取得する

Home Assistantで以下の手順を実施します。
1. プロフィール（左下）をクリック
2. 「長期アクセストークン（Long-Lived Access Tokens）」までスクロール
3. 「トークンを作成」をクリック
4. 名前を「OpenClaw」とし、トークンをすぐにコピーする（再表示されません）

## Home Assistant MCPサーバーのインストール

```bash
npm install -g @modelcontextprotocol/server-home-assistant
```

動作確認：

```bash
HA_URL=http://homeassistant.local:8123 \
HA_TOKEN=your_token_here \
npx @modelcontextprotocol/server-home-assistant
# Should start without errors
```

## OpenClawの設定

OpenClawの設定ファイルにMCPサーバーを追加します。

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

環境変数を設定します。

```bash
export HA_TOKEN="your_long_lived_access_token"
# Add to ~/.zshrc or ~/.bashrc to persist
```

OpenClawを再起動します。

```bash
openclaw restart
openclaw mcp list
# Should show: home-assistant (X tools)
```

## 利用可能なツール

HA MCPサーバーはOpenClawに以下のツールを公開します。

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

これは非常に広範な操作領域であり、モデルはHA UIでできることのほぼすべてを実行できます。

## 基本コマンド

接続が完了すると、自然言語コマンドがすぐに使えるようになります。

```
"リビングの気温は何度ですか？"
"全部の照明を消して"
"寝室のサーモスタットを68°Fに設定して"
"誰か家にいる？"
"玄関のドアを施錠して"
"すべてのセンサーのバッテリー残量を教えて"
```

モデルはこれらを適切なサービス呼び出しに変換します。「全部の照明を消して」のようなマルチエンティティコマンドの場合、まず `get_states` を呼び出してすべての照明エンティティを取得し、次に関連エンティティに対して `call_service` を呼び出します。

## 実用例

**オンデマンドの朝のルーティン：**

```
あなた：「おはよう。45分後に出発するから、朝の準備ができるように家をセットアップして」

OpenClaw：朝のルーティンを設定します。
- キッチンの照明 → 明るさ80%、暖色白
- コーヒーメーカー → オン（エンティティが利用可能な場合）
- リビングのブラインド → 開ける
- サーモスタット → 70°F
- 玄関のドアロック → 施錠確認済み

他に朝の準備で必要なことはありますか？
```

**デバイスの問題を診断する：**

```
あなた：「オフィスのモーションセンサーが2日間反応していないんだけど、何が起きてるの？」

OpenClaw：[センサーエンティティの get_history を呼び出し]

binary_sensor.office_motion の履歴を確認しました：
- 最終検知：2日前の午前9:47
- バッテリー：8%（3日前に最終報告）
- 現在の状態：利用不可

センサーが利用不可になっており、バッテリーが8%であることから、電池切れの可能性が高いです。電池を交換すれば自動的に再接続されるはずです。10分以内に再接続されない場合は、ZigbeeまたはZ-Waveコーディネーターと再ペアリングが必要かもしれません。
```

**オートメーションの作成：**

```
あなた：「日没後に玄関ドアが開いたら玄関灯をつけて、ドアが閉まってから5分後に消すオートメーションを作って」

OpenClaw：[list_automations で競合を確認してから create_automation を呼び出し]

オートメーション「日没後のドア開放時に玄関灯をオン」を作成しました：
- トリガー：front_door の状態が 'open' に変化
- 条件：太陽が地平線より低い位置にある
- アクション：porch_light をオン
- 追加トリガー：front_door の状態が 'closed' に変化
- 追加アクション：5分の遅延後に porch_light をオフ

オートメーションが有効になりました。ドアの開放イベントをシミュレートしてテストしますか？
```

**エネルギー監視の問い合わせ：**

```
あなた：「今一番電力を使っているデバイスはどれ？」

OpenClaw：[すべての電力監視エンティティで get_states を呼び出し]

現在の消費電力（多い順）：
1. HVACシステム：2,340W
2. オーブン（つけっぱなし！）：1,800W
3. EVチャージャー：1,200W
4. 冷蔵庫：145W
5. テレビ＋エンターテインメント：87W

注意：オーブンがオンになっているようですが、意図的ですか？現在の総消費電力：約5.6kW
```

## セキュリティについて

HA MCPサーバーはローカルで動作し、HAインスタンスと直接通信します。主なセキュリティ上の注意点は以下のとおりです。

**OpenClawの操作範囲を制限する。** HAのアクセストークンはデフォルトでインスタンスへのフルアクセス権を持ちます。より制限された構成にするには、HAのAPIキースコーピング（一部のHAバージョンで利用可能）を使うか、呼び出し可能なサービスを制限するプロキシを導入することを検討してください。

**HAの外部URLを公開しない。** MCPサーバーはローカルのHAアドレスを使用するよう設定し、外部のHA Cloud URLは使わないようにしてください。すべての通信はローカルネットワーク内に留めるべきです。

**有効化前にオートメーションを確認する。** OpenClawにオートメーションを作成させる場合、適用前にYAMLを確認してください。モデルは優秀ですが完璧ではありません。エッジケースを必ずチェックしてください。

```yaml
# More restrictive config: use local network only
mcpServers:
  home-assistant:
    env:
      HA_URL: "http://192.168.1.100:8123"  # Direct IP, not external URL
      HA_TOKEN: "${HA_TOKEN}"
```

**OpenClawの操作ログを記録する。** HAで重要なエンティティのログブックを有効にしてください。予期しない事態が発生した場合、どのサービスがいつ呼び出されたかを追跡できます。

## 応用：音声コマンド

OpenClawのMCP統合と音声入力サポートを組み合わせて、ハンズフリーでスマートホームを操作できます。

```bash
# OpenClaw with voice input (when configured)
openclaw voice --provider home-assistant

# Or use the keyboard shortcut in OpenClaw's terminal UI
# Voice input → transcription → model processes → HA executes
```

音声から実行までの遅延は通常合計3〜5秒です。音声認識に約1秒、モデルの推論に1〜2秒、HAサービスの実行に約1秒かかります。

## 複数の住宅やゾーンを管理する

複数のHAインスタンス（自宅＋別荘など）がある場合は、複数のMCPサーバーインスタンスを設定します。

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

モデルは両方に対応できます。「別荘の照明を誰かが消し忘れていないか確認して。」

## よくある質問

**Zigbee/Z-Wave/Matter/WiFiデバイスでも使えますか？**

はい。OpenClawはHome Assistantのエンティティ層と連携しており、この層がすべてのデバイスプロトコルを抽象化しています。デバイスがHAにエンティティとして表示される限り、OpenClawはそれを制御できます。

**OpenClawが誤操作してしまうことはありますか？**

モデルは実際のHAサービスを呼び出します。理論上、意図していないサービスを呼び出す可能性はあります。実際には、モデルは破壊的な操作に対して慎重であり、不可逆な操作（アラームの無効化など）を実行する前に通常は確認を求めます。予期しないコマンドには常に注意を払ってください。

**Home Assistant Cloud（Nabu Casa）でも動作しますか？**

はい。ローカルアドレスの代わりにHA Cloudの外部URLを使用してください。クラウドを経由する分、パフォーマンスはやや低下します。

**HAインスタンスに何百ものエンティティがある場合はどうなりますか？**

`get_states` の呼び出しはすべてのエンティティを返すため、ペイロードが大きくなる可能性があります。モデルは問題なく処理しますが、レスポンスが若干遅くなることがあります。エンティティ数が非常に多いインストール（500以上）では、コマンドでドメインを指定してフィルタリングすることをお勧めします。「すべての照明エンティティを表示して。」

**Ollamaのオフラインセットアップでも使用できますか？**

はい。MCPサーバーはモデルのバックエンドとは独立しています。OpenClawをOllamaをプロバイダーとして使用するよう設定しても、HA MCPサーバーは引き続き利用できます。HAがローカルに展開されている場合、スマートホームの制御は完全にオフラインで動作します。

OpenClaw + Home Assistantの統合は、私の家との関わり方を大きく変えました。オートメーションを作成するプロセスが、YAMLを直接編集するよりも会話形式の方がずっと自然に感じられますし、平易な言葉で診断を問い合わせられることでトラブルシューティングの時間も大幅に短縮されます。既存のHAインストールがあれば、セットアップにかかる時間はおよそ15分です。
