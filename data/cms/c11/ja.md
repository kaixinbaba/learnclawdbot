---
title: "Raspberry Pi 5でOpenClawを動かす：完全ハードウェアガイド"
description: "Raspberry Pi 5でプライベートな常時稼働ローカルAIゲートウェイを構築。ARM64インストール手順、パフォーマンス最適化、Home Assistant連携のアイデアを網羅。"
publishedAt: 2026-03-14
status: published
visibility: public
---

# Raspberry Pi 5でOpenClawを動かす：完全ハードウェアガイド

常時稼働・完全プライベート・消費電力わずか約5Wの自宅AIゲートウェイを運用するアイデアは、ホビイストの実験から実用的なセットアップへと進化しました。**Raspberry Pi 5**は、**OpenClaw**を快適にホストするのに十分な演算能力とメモリを備えており、自宅ネットワークをオートメーション・ファイル管理・個人AI業務のインテリジェントハブに変えることができます。

## 理想的なハードウェア：Raspberry Pi 5が最適な理由

Pi 5は前世代から大幅に進化しています：

- **CPU**：Arm Cortex-A76 クアッドコア 2.4 GHz — Pi 4の約2〜3倍のスループット
- **RAM**：4GB または 8GB LPDDR4X — 4GBでOpenClawは快適に動作、8GBなら複数スキルの同時実行にも余裕
- **ストレージ**：PCIe 2.0経由のNVMe SSD（M.2 HAT必要）— 信頼性と速度でmicroSDより圧倒的に有利
- **USB 3.0**：外付けドライブや周辺機器にも十分な転送速度
- **消費電力**：アイドル時約5W、高負荷時約12W — 電気代は無視できるレベル

安定した運用のために以下を合わせて揃えることをおすすめします：
- **高品質なUSB-C電源**（27W PD推奨 — 公式Pi 5電源で問題なし）
- **アクティブクーラー**（公式Pi 5ケースファンまたはPimoroni Pico HATなど）
- **128GB以上のNVMe SSD**（OSとOpenClawデータ用）

## OSのセットアップ：Ubuntu/DebianまたはDocker

### オプションA：Raspberry Pi OS（Debian Bookworm、64ビット）

公式64ビット Raspberry Pi OSが最も手軽な選択肢です：

```bash
# Raspberry Pi Imagerでフラッシュ
# 選択：Raspberry Pi OS（64ビット）→ ストレージデバイス
# Imagerの詳細設定でSSHを有効化してホスト名を設定
```

初回起動後にシステムを更新：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### オプションB：Raspberry Pi OS上でDocker

コンテナ化された展開（更新が簡単・環境を綺麗に分離）を好む場合：

```bash
# Dockerのインストール
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Composeのインストール
sudo apt install -y docker-compose-plugin
```

## ARM64でのOpenClawインストール

OpenClawはv1.2以降、ARM64（aarch64）を正式サポートしています。以下が具体的な手順です。

### Node.jsのインストール（NodeSource経由）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x.x と表示されるはず
```

### OpenClawのクローンとインストール

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install --production
cp .env.example .env
nano .env  # APIキーと設定を入力
```

### Dockerデプロイ（代替方法）

```bash
# Docker Composeでプルして起動
wget https://raw.githubusercontent.com/openclaw/openclaw/main/docker-compose.yml
# docker-compose.ymlに環境変数を追加してから：
docker compose up -d
```

### システムサービスとして登録

OpenClawを起動時に自動実行されるよう設定：

```bash
sudo nano /etc/systemd/system/openclaw.service
```

```ini
[Unit]
Description=OpenClaw AI Gateway
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/openclaw
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

## パフォーマンスの最適化

Pi 5はOpenClawをしっかり動かせますが、いくつかの調整で体感が大きく変わります。

### Node.jsのメモリ制限

デフォルトではNode.jsのヒープメモリ上限は約512MBです。4GB RAMのPiではもう少し割り当てられます：

```bash
# .envまたはsystemdサービスのEnvironment行に追加：
NODE_OPTIONS=--max-old-space-size=1024
```

8GBモデルでは2048まで増やせます。

### ヘッドレスモード

グラフィカルデスクトップ環境を無効にして、約150MBのRAMとアイドルCPU使用率を節約：

```bash
sudo raspi-config
# → System Options → Boot / Auto Login → Console
```

### スワップの設定

4GBモデルでは安全網としてスワップを追加しておきましょう：

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=1024 に変更
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### NVMeをmicroSDの代わりに使う

データベースの読み書き（OpenClawの会話履歴・ファイルインデックス）が発生する場合、NVMeはmicroSDを圧倒します。M.2 HATを使ってPi 5のPCIeインターフェース経由でNVMeから起動しましょう。

## 活用アイデア

OpenClawがPi上で動き始めると、活用の可能性はチャット以外にも大きく広がります：

**Home Assistantとの連携**：OpenClawのWebhookスキルを使い、自然言語でHome Automationをトリガー。「20分後に全部の照明を消して」がローカルで処理される音声コマンドになります。

**ローカルファイル管理**：NASや外付けドライブにOpenClawのFile System Managerプラグインを向ける。「今月編集したPDFを全部探して」「/Downloadsの写真を/Photos/2026に移して」を自然語で操作できます。

**プライベート文書Q&A**：軽量な埋め込みモデルをローカルで動かし、個人文書への質問をクラウドに送らずOpenClawで処理。

**ローカルネットワーク監視**：デバイスの死活確認・帯域使用状況チェック・Pi-holeのブロックリスト統計の夜間サマリー生成など、スケジュール実行スキルで自動化。

**個人日記とメモ管理**：OpenClawが24時間稼働しているので、スマートフォンからいつでもメモや音声メモを追加。自動で処理・タグ付け・インデックス化されます。

## 今すぐ始めよう

Raspberry Pi 5は、2026年にOpenClawをセルフホストするための最高のシングルボードコンピュータです。100ドル以下のハードウェアで、日常生活で実際に役立つプライベートな常時稼働AIゲートウェイが手に入ります。

[OpenClawをダウンロード](https://openclaw.dev)して、ARM64セットアップドキュメントを確認してください。今日からあなたのPiアシスタントを起動できます。
