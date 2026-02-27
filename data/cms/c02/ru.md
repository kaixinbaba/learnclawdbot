---
title: "автоматизации бронирования кортов через padel-cli + OpenClaw"
description: "Как пользователь с частыми бронированиями перевёл процесс проверки доступности и записи на корт в автоматизированный поток с padel-cli и OpenClaw."
---

# C02: пользовательский кейс автоматизации бронирования кортов через padel-cli + OpenClaw

## Профиль кейса

- **Категория:** Автоматизация / плагинный workflow
- **Для кого:** Пользователи, которые регулярно ищут и бронируют корты через Playtomic
- **Источники:**
  - [OpenClaw Docs: Showcase](https://docs.openclaw.ai/start/showcase)
  - [joshp123/padel-cli](https://github.com/joshp123/padel-cli)

## Контекст

Игрок, который часто бронирует вечерние слоты, тратил слишком много времени на повторяющиеся ручные проверки:

- открыть приложение
- выбрать локацию/дату/время
- повторять те же шаги каждый день

Цель — перейти к сценарию, который можно запускать скриптами, повторять и подключать к OpenClaw.

## Подтверждённые возможности по источникам

По README и Showcase у padel-cli есть:

1. Команды поиска и проверки доступности
2. Команды бронирования после авторизации
3. Управление alias для площадок (venue)
4. Вывод `--json` для автоматизированных цепочек
5. `openclawPlugin` flake output для интеграции с nix-openclaw

## Путь внедрения

### 1) Сборка CLI и базовая проверка поиска

```bash
go build -o padel
padel clubs --near "Madrid"
padel search --location "Barcelona" --date 2025-01-05 --time 18:00-22:00
```

### 2) Настройка авторизации и бронирования

```bash
padel auth login --email you@example.com --password yourpass
padel auth status
padel book --venue myclub --date 2025-01-05 --time 10:30 --duration 90
```

### 3) Стабилизация повторяемых операций через venue alias

```bash
padel venues add --id "<playtomic-id>" --alias myclub --name "My Club" --indoor --timezone "Europe/Madrid"
padel venues list
padel search --venues myclub --date 2025-01-05 --time 09:00-11:00
```

### 4) Подключение к плагинному потоку OpenClaw

В репозитории явно указан `openclawPlugin` flake output. Для nix-openclaw это означает, что пакеты плагина добавляются в `PATH`, а skills подключаются в рабочее пространство через symlink.

## Результат (только по подтверждаемым данным)

- Процесс можно перевести с ручных действий в приложение на скриптовый сценарий
- Поиск/доступность/бронирование становятся компонуемыми шагами
- JSON-вывод и alias повышают стабильность повторяемых запусков

## Подтверждённые факты и точки для проверки

### ✅ Подтверждено

- В padel-cli есть команды `search`, `availability`, `auth`, `book`, `venues`
- padel-cli поддерживает JSON-вывод
- `openclawPlugin` flake output задокументирован для nix-openclaw
- В OpenClaw Showcase есть отдельный блок "Padel Court Booking" с ссылкой на проект

### ⚠️ Требует доп. валидации

- Точное еженедельное время экономии у разных пользователей
- Рост процента успешных бронирований по городам/клубам
- Долгосрочная динамика успеха в пиковые интервалы

## Практические замечания

- Храните креды и настройки в защищённом локальном каталоге (`~/.config/padel`)
- Перед автозапуском проверяйте соответствие timezone и venue alias
- Для критичных действий бронирования оставляйте шаг подтверждения

## Ссылки

- [OpenClaw Showcase](https://docs.openclaw.ai/start/showcase)
- [padel-cli README](https://github.com/joshp123/padel-cli)
