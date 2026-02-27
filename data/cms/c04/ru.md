---
title: "управление BambuLab через bambu-cli + OpenClaw"
description: "Как построить воспроизводимый сценарий управления BambuLab с bambu-cli и OpenClaw на основе проверяемых публичных источников."
---

# Кейс C04: управление BambuLab через bambu-cli + OpenClaw

## Профиль кейса

- **Категория:** Автоматизация / аппаратный workflow
- **Для кого:** Пользователи, которым нужен командный и повторяемый процесс работы с принтерами BambuLab
- **Источники:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [tobiasbischoff/bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
  - [bambu-cli README (raw)](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)

## Контекст

Если операции с принтером выполняются только через GUI, повторяющиеся действия (проверка статуса, запуск печати, переключение настроек) часто становятся фрагментированными.

В этом кейсе используется документированный command-first подход:

- один раз настроить,
- повторно выполнять операционные команды,
- передавать результат в диалог OpenClaw для следующих шагов.

## Подтвержденные возможности по источникам

По README bambu-cli и странице OpenClaw Showcase:

1. `bambu-cli` — CLI для управления BambuLab через MQTT/FTPS/камеру.
2. В документации есть установка и quick start (`brew install`, `config set`, `status`, `print start`).
3. Описан приоритет конфигурации (flags > env > project config > user config).
4. Указаны необходимые порты (8883 MQTT, 990 FTPS, 6000 camera).
5. В OpenClaw Showcase есть карточка “Bambu 3D Printer Control” как community-проект для контроля/диагностики печати.

## Путь внедрения

### 1) Установить bambu-cli

```bash
brew install tobiasbischoff/tap/bambu-cli
```

### 2) Настроить профиль принтера и хранить access code в файле

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

### 3) Выполнять операционные команды

```bash
bambu-cli status
bambu-cli print start ./benchy.3mf --plate 1
```

### 4) Подключить к workflow OpenClaw

Передавайте вывод CLI в диалог OpenClaw для анализа статуса, runbook-подсказок и troubleshooting.

## Результат (в рамках проверяемых данных)

- GUI-only процесс можно перевести в воспроизводимый набор команд.
- Документированный профиль и приоритеты конфигурации повышают предсказуемость между окружениями.
- Файловое хранение access code безопаснее, чем передача секрета напрямую в флагах команды.

## Подтвержденные факты vs что нужно валидировать

### ✅ Подтверждено источниками

- `bambu-cli` управляет BambuLab через MQTT/FTPS/camera.
- Установка через Homebrew и базовые команды явно описаны в README.
- Приоритеты конфигурации и требования по портам документированы.
- OpenClaw Showcase включает “Bambu 3D Printer Control”.

### ⚠️ Требует валидации (интервью/телеметрия)

- Средняя экономия времени на одну печатную операцию
- Изменение процента ошибок после перехода с GUI-only процесса
- Рост пропускной способности в сценариях с несколькими принтерами

## Практические заметки

- Храните access code в файле и ограничивайте права (`chmod 600`).
- Перед автоматизацией проверяйте доступность портов MQTT/FTPS/camera.
- Фиксируйте конфигурацию явно, чтобы уменьшить дрейф между машинами.

## Ссылки

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [репозиторий bambu-cli](https://github.com/tobiasbischoff/bambu-cli)
- [README bambu-cli](https://github.com/tobiasbischoff/bambu-cli/blob/master/README.md?raw=1)
