---
title: "декларативного развёртывания OpenClaw через nix-openclaw"
description: "Как небольшая ops-команда стандартизировала развёртывание OpenClaw с помощью nix-openclaw и Home Manager на macOS и Linux."
---

# C01: пользовательский кейс декларативного развёртывания OpenClaw через nix-openclaw

## Профиль кейса

- **Категория:** Деплой / инфраструктура
- **Для кого:** команды, которые поддерживают OpenClaw в постоянной эксплуатации
- **Источники:**
  - [Документация OpenClaw: установка через Nix](https://docs.openclaw.ai/install/nix)
  - [openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)

## Исходная ситуация

Команда из 3 инженеров поддерживала OpenClaw на Mac mini и Linux VPS. Раньше использовался ручной, пошаговый процесс установки с локальными правками. Это приводило к повторяющимся проблемам:

- разные версии CLI-инструментов на разных машинах
- сложность аудита локальных изменений конфигурации
- долгий откат после неудачного обновления

Команда решила перейти к декларативному подходу.

## Боли до миграции

1. **Дрейф конфигураций** между окружениями
2. **Низкая воспроизводимость** при добавлении новых машин
3. **Рискованные обновления** без ясной процедуры отката
4. **Смешение зон ответственности** между фиксированной конфигурацией и runtime-состоянием

## Почему выбрали nix-openclaw

Согласно официальной документации и README репозитория, nix-openclaw даёт:

- модуль **Home Manager** для OpenClaw
- фиксирование зависимостей через Nix
- системные сервисы: **launchd** (macOS) и **systemd --user** (Linux)
- режим **Nix mode** (`OPENCLAW_NIX_MODE=1`) с отключением auto-mutation
- быстрый rollback через поколения Home Manager

## Путь внедрения

### 1) Инициализация flake из шаблона

Команда использовала `templates/agent-first/flake.nix` и заполнила плейсхолдеры (пользователь, система, каналы).

### 2) Разделение pin-конфига и runtime-состояния

- Декларативный конфиг: flake + `programs.openclaw.config`
- Документы: `AGENTS.md`, `SOUL.md`, `TOOLS.md`
- Runtime-данные: `~/.openclaw`

Это соответствует принципу Golden Paths: "pinned config vs runtime state".

### 3) Секреты через файловые пути

Токены Telegram и API-ключи подключались через пути к файлам, без inline-секретов в конфиге.

### 4) Применение и проверка

```bash
home-manager switch --flake .#<user>
```

Проверка:

- macOS: `launchctl print gui/$UID/com.steipete.openclaw.gateway`
- Linux: `systemctl --user status openclaw-gateway`

## Результат

- онбординг новой машины стал воспроизводимым и стандартизированным
- обновления стали предсказуемее благодаря pin-зависимостям
- появился прозрачный путь отката (`home-manager switch --rollback`)
- обсуждение изменений перешло в формат code review по конфигам

## Практические замечания

- На macOS права TCC (Screen Recording, Accessibility) требуют разового ручного подтверждения.
- Для декларативной модели стоит держать Nix mode включённым.
- Источники плагинов лучше фиксировать, а изменения деплоя проводить через review.

## Ссылки

- [Обзор установки OpenClaw через Nix](https://docs.openclaw.ai/install/nix)
- [README и опции модуля nix-openclaw](https://github.com/openclaw/nix-openclaw)
- [Руководство Golden Paths](https://github.com/openclaw/nix-openclaw/blob/main/docs/golden-paths.md)
