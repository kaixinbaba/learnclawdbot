---
title: "C04 사용자 사례: bambu-cli + OpenClaw로 BambuLab 3D 프린터 운영 표준화"
description: "공개 문서를 근거로 bambu-cli와 OpenClaw를 결합해 재현 가능한 BambuLab 제어 워크플로를 구축하는 방법."
---

# C04 사용자 사례: bambu-cli + OpenClaw로 BambuLab 3D 프린터 운영 표준화

## 사례 개요

- **카테고리:** 자동화 / 하드웨어 워크플로
- **대상 사용자:** BambuLab 프린터 작업을 명령형으로 안정적으로 운영하고 싶은 사용자
- **출처:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [tobiasbischoff/bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
  - [bambu-cli README (raw)](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## 배경

프린터 작업을 GUI에만 의존하면 상태 확인, 출력 시작, 설정 전환 같은 반복 작업이 분산되기 쉽습니다.

이 사례는 문서로 검증 가능한 명령 중심 경로에 초점을 둡니다.

- 초기 설정 1회,
- 운영 명령 반복 실행,
- 결과를 OpenClaw 대화에 연결해 후속 판단 수행.

## 출처로 검증 가능한 기능

bambu-cli README와 OpenClaw Showcase 기준:

1. `bambu-cli`는 MQTT/FTPS/카메라 경로로 BambuLab 프린터를 제어하는 CLI입니다.
2. 설치 및 빠른 시작 명령(`brew install`, `config set`, `status`, `print start`)이 문서화되어 있습니다.
3. 설정 우선순위(flags > env > project config > user config)가 정의되어 있습니다.
4. 필요 포트(8883 MQTT, 990 FTPS, 6000 camera)가 문서에 명시되어 있습니다.
5. OpenClaw Showcase는 “Bambu 3D Printer Control”을 커뮤니티 사례로 소개합니다.

## 구현 경로

### 1) bambu-cli 설치

```bash
brew install tobiasbischoff/tap/bambu-cli
```

### 2) 파일 기반 access code + 프린터 profile 설정

```bash
mkdir -p ~/.config/bambu
printf "%s" "YOUR_ACCESS_CODE" > ~/.config/bambu/lab.code
chmod 600 ~/.config/bambu/lab.code

bambu-cli config set --printer lab \
  --ip 192.168.1.200 \
  --serial AC12309BH109 \
  --access-code-file ~/.config/bambu/lab.code \
  --default
```

### 3) 운영 명령 실행

```bash
bambu-cli status
bambu-cli print start ./benchy.3mf --plate 1
```

### 4) OpenClaw 워크플로에 연결

CLI 출력 결과를 OpenClaw 대화에 넣어 상태 점검, 운영 가이드, 트러블슈팅을 이어갑니다.

## 결과(근거 기반)

- GUI 중심 루틴을 재현 가능한 명령 단계로 전환할 수 있습니다.
- profile + 우선순위 규칙으로 환경 간 동작 예측 가능성이 높아집니다.
- access code를 파일로 관리하면 플래그 직접 전달보다 안전한 자동화가 가능합니다.

## 확인된 사실 vs 추가 검증 필요

### ✅ 확인됨(출처 기반)

- `bambu-cli`는 MQTT/FTPS/camera를 통해 BambuLab을 제어합니다.
- Homebrew 설치 및 핵심 명령이 README에 명시되어 있습니다.
- 설정 우선순위와 필요 포트가 문서화되어 있습니다.
- OpenClaw Showcase에 “Bambu 3D Printer Control”이 포함되어 있습니다.

### ⚠️ 추가 검증 필요(사용자 인터뷰/계측)

- 작업 1건당 평균 시간 절감률
- GUI-only 대비 실패율 변화
- 다중 프린터 운영 시 처리량 개선 폭

## 실무 메모

- access code는 파일 저장 + `chmod 600` 권한 제한을 권장합니다.
- 자동화 전에 MQTT/FTPS/camera 포트 연결성을 확인하세요.
- 구성을 명시적으로 관리해 장비 간 설정 드리프트를 줄이세요.

## 참고 링크

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [bambu-cli repository](https://github.com/tobiasbischoff/bambu-cli)
- [bambu-cli README](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)
