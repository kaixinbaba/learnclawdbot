---
title: "C01 사용자 사례: nix-openclaw 기반 OpenClaw 선언형 배포"
description: "소규모 운영팀이 nix-openclaw와 Home Manager를 활용해 macOS / Linux 환경에서 OpenClaw를 재현 가능하고 롤백 가능한 방식으로 표준화한 사례입니다."
---

# C01 사용자 사례: nix-openclaw 기반 OpenClaw 선언형 배포

## 사례 개요

- **카테고리:** 배포 / 인프라
- **대상:** OpenClaw를 상시 운영하는 엔지니어링 팀
- **출처:**
  - [OpenClaw 문서: Nix 설치](https://docs.openclaw.ai/install/nix)
  - [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)

## 배경

3인 플랫폼 팀은 Mac mini와 Linux VPS에서 OpenClaw를 운영 중이었습니다. 기존에는 수동 설치와 로컬 수정에 의존해 다음 문제가 반복되었습니다.

- 머신별 CLI 버전 불일치
- 로컬 설정 변경 이력 추적 어려움
- 업데이트 실패 시 복구 지연

팀은 이를 해결하기 위해 선언형 배포로 전환했습니다.

## 전환 전 핵심 문제

1. **환경 드리프트**
2. **재현성 부족**
3. **업데이트 리스크**
4. **고정 설정과 런타임 상태 경계 불명확**

## nix-openclaw 선택 이유

공식 문서와 저장소에서 확인한 장점은 다음과 같습니다.

- OpenClaw용 **Home Manager 모듈** 제공
- Nix 기반 의존성 고정으로 일관된 빌드
- macOS는 **launchd**, Linux는 **systemd --user**로 서비스 관리
- `OPENCLAW_NIX_MODE=1` 기반 **Nix mode** 지원
- Home Manager generations 기반 빠른 롤백

## 적용 경로

### 1) 공식 템플릿으로 flake 시작

`templates/agent-first/flake.nix`를 기반으로 사용자/시스템/채널 값을 채웠습니다.

### 2) 선언형 설정과 런타임 상태 분리

- 선언형 설정: flake + `programs.openclaw.config`
- 문서 자산: `AGENTS.md`, `SOUL.md`, `TOOLS.md`
- 런타임 상태: `~/.openclaw`

이는 Golden Paths의 "pinned config vs runtime state" 원칙과 일치합니다.

### 3) 시크릿 파일 경로 주입

Telegram 토큰과 API 키는 설정에 직접 쓰지 않고 파일 경로로 주입했습니다.

### 4) 적용 및 검증

```bash
home-manager switch --flake .#<user>
```

검증 포인트:

- macOS: `launchctl print gui/$UID/com.steipete.openclaw.gateway`
- Linux: `systemctl --user status openclaw-gateway`

## 결과

- 신규 장비 온보딩이 flake 중심으로 표준화
- 의존성 고정으로 업데이트 예측 가능성 향상
- `home-manager switch --rollback` 기반 복구 경로 명확화
- 운영 지식이 개인 노하우에서 코드 리뷰 가능한 설정 변경으로 이동

## 실무 팁

- macOS TCC 권한(화면 녹화/접근성 등)은 1회 수동 승인 필요
- 선언형 운영에서는 Nix mode를 유지하는 것이 안전
- 플러그인 소스는 고정(ref/pin)하고 배포 변경은 PR 리뷰 권장

## 참고 링크

- [OpenClaw Nix 설치 개요](https://docs.openclaw.ai/install/nix)
- [nix-openclaw README 및 모듈 옵션](https://github.com/openclaw/nix-openclaw)
- [Golden Paths 문서](https://github.com/openclaw/nix-openclaw/blob/main/docs/golden-paths.md)
