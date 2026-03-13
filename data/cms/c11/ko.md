---
title: "Raspberry Pi 5에서 OpenClaw 실행하기: 완전한 하드웨어 가이드"
description: "Raspberry Pi 5로 프라이빗 상시 가동 로컬 AI 게이트웨이 구축. ARM64 설치 절차, 성능 최적화 팁, Home Assistant 연동 아이디어 포함."
publishedAt: 2026-03-14
status: published
visibility: public
---

# Raspberry Pi 5에서 OpenClaw 실행하기: 완전한 하드웨어 가이드

항상 켜져 있고, 완전히 프라이빗하며, 소비 전력이 약 5W에 불과한 자택 AI 게이트웨이를 운영하는 아이디어가 취미 실험에서 진정으로 실용적인 설정으로 발전했습니다. **Raspberry Pi 5**는 **OpenClaw**를 편안하게 호스팅하기에 충분한 연산 능력과 메모리를 갖추고 있어, 자택 네트워크를 자동화, 파일 관리, 개인 AI 작업을 위한 지능형 허브로 탈바꿈시킬 수 있습니다.

## 이상적인 하드웨어: Raspberry Pi 5가 완벽한 이유

Pi 5는 전 세대 대비 의미 있는 세대 도약을 이루었습니다:

- **CPU**: Arm Cortex-A76 쿼드코어 2.4GHz — Pi 4 대비 약 2~3배 처리량
- **RAM**: 4GB 또는 8GB LPDDR4X — OpenClaw는 4GB에서도 잘 동작하며, 8GB는 여러 스킬 동시 실행에 여유 제공
- **스토리지**: PCIe 2.0 경유 NVMe SSD (M.2 HAT 필요) — 안정성과 속도 면에서 microSD보다 권장
- **USB 3.0**: 외장 드라이브 및 주변기기에 충분한 속도
- **소비 전력**: 대기 시 약 5W, 부하 시 약 12W — 전기 요금 무시 가능 수준

안정적인 운용을 위한 추천 조합:
- **고품질 USB-C 전원** (27W PD 권장 — 공식 Pi 5 전원 어댑터 사용 가능)
- **액티브 쿨러** (공식 Pi 5 케이스 팬 또는 Pimoroni Pico HAT)
- **128GB 이상 NVMe SSD** (OS 및 OpenClaw 데이터용)

## OS 설치: Ubuntu/Debian 또는 Docker

### 옵션 A: Raspberry Pi OS (Debian Bookworm, 64비트)

공식 64비트 Raspberry Pi OS가 가장 간편한 선택입니다:

```bash
# Raspberry Pi Imager로 플래시
# 선택: Raspberry Pi OS (64비트) → 스토리지 장치
# Imager 고급 옵션에서 SSH 활성화 및 호스트명 설정
```

첫 부팅 후 시스템 업데이트:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 옵션 B: Raspberry Pi OS에서 Docker 사용

컨테이너화 배포를 선호하는 경우 (업데이트 용이, 환경 분리 깔끔):

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose 설치
sudo apt install -y docker-compose-plugin
```

## ARM64에서 OpenClaw 설치

OpenClaw는 v1.2부터 ARM64(aarch64)를 완전히 지원합니다. 구체적인 단계는 다음과 같습니다.

### Node.js 설치 (NodeSource 경유)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x.x 표시 확인
```

### OpenClaw 클론 및 설치

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install --production
cp .env.example .env
nano .env  # API 키 및 설정 입력
```

### Docker 배포 (대안)

```bash
# Docker Compose로 다운로드 및 실행
wget https://raw.githubusercontent.com/openclaw/openclaw/main/docker-compose.yml
# docker-compose.yml에 환경 변수 추가 후:
docker compose up -d
```

### 시스템 서비스로 등록

OpenClaw가 부팅 시 자동 시작되도록 설정:

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

## 성능 최적화

Pi 5는 OpenClaw를 잘 처리하지만, 몇 가지 조정으로 체감 성능이 크게 달라집니다.

### Node.js 메모리 제한

기본적으로 Node.js는 힙 메모리를 약 512MB로 제한합니다. 4GB Pi에서는 더 많이 할당할 수 있습니다:

```bash
# .env 또는 systemd 서비스 Environment 줄에 추가:
NODE_OPTIONS=--max-old-space-size=1024
```

8GB 모델에서는 2048까지 늘릴 수 있습니다.

### 헤드리스 모드

그래픽 데스크탑 환경을 비활성화해 약 150MB RAM과 유휴 CPU를 회수:

```bash
sudo raspi-config
# → System Options → Boot / Auto Login → Console
```

### 스왑 설정

4GB 모델의 경우 안전망으로 스왑을 추가:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=1024 로 설정
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### microSD 대신 NVMe 사용

데이터베이스 읽기/쓰기(OpenClaw의 대화 기록, 파일 인덱싱)가 있는 워크로드라면 NVMe가 microSD를 압도합니다. M.2 HAT을 사용해 Pi 5의 PCIe 인터페이스로 NVMe에서 부팅하세요.

## 활용 아이디어

OpenClaw가 Pi에서 실행되면 채팅을 훨씬 넘어서는 가능성이 열립니다:

**Home Assistant 연동**: OpenClaw의 웹훅 스킬을 사용해 자연어로 Home Assistant 자동화 트리거. "20분 후에 모든 조명 꺼줘"가 로컬에서 처리되는 음성 명령이 됩니다.

**로컬 파일 관리**: OpenClaw의 File System Manager 플러그인을 NAS나 외장 드라이브에 연결. "이번 달에 수정된 PDF 찾아줘" 또는 "/Downloads에서 사진을 /Photos/2026으로 옮겨줘" 등 자연어로 조작.

**프라이빗 문서 Q&A**: 경량 임베딩 모델을 로컬에서 실행하고 OpenClaw로 개인 문서에 대한 질문에 답변 — 클라우드에 데이터 전송 없이.

**로컬 네트워크 모니터링**: OpenClaw 스킬을 스케줄링해 장치 가용성 확인, 대역폭 사용량 모니터링, 또는 Pi-hole 차단 목록 통계의 야간 요약 생성.

**개인 일기 및 메모**: OpenClaw가 24/7 실행 중이니 언제든 스마트폰에서 메모나 음성 메모를 추가하면 자동으로 처리, 태그 지정, 인덱싱됩니다.

## 지금 시작하세요

Raspberry Pi 5는 2026년 OpenClaw를 셀프 호스팅하기에 가장 좋은 싱글보드 컴퓨터입니다. 100달러 미만의 하드웨어로 일상에서 진정으로 유용한 프라이빗 상시 가동 AI 게이트웨이를 손에 넣을 수 있습니다.

[OpenClaw를 다운로드](https://openclaw.dev)하고 ARM64 설치 문서를 확인하세요 — 오늘 바로 Pi 어시스턴트를 시작할 수 있습니다.
