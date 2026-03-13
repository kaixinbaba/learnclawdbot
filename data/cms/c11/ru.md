---
title: "OpenClaw на Raspberry Pi 5: полное руководство по аппаратному обеспечению"
description: "Как развернуть приватный круглосуточный локальный ИИ-шлюз на Raspberry Pi 5. Инструкция по установке ARM64, оптимизация производительности и интеграция с Home Assistant."
publishedAt: 2026-03-14
status: published
visibility: public
---

# OpenClaw на Raspberry Pi 5: полное руководство по аппаратному обеспечению

Идея запустить дома собственный ИИ-шлюз — всегда включённый, полностью приватный, с потреблением около 5 Вт — перестала быть экспериментом для энтузиастов и стала по-настоящему практичным решением. **Raspberry Pi 5** обеспечивает достаточно вычислительных ресурсов и памяти для комфортного размещения **OpenClaw**, превращая домашнюю сеть в интеллектуальный центр автоматизации, управления файлами и персональных ИИ-задач.

## Идеальное железо: почему Raspberry Pi 5

Pi 5 — это значительный скачок вперёд по сравнению с предшественником:

- **CPU**: Arm Cortex-A76, четыре ядра по 2,4 ГГц — производительность примерно в 2–3 раза выше, чем у Pi 4
- **ОЗУ**: 4 ГБ или 8 ГБ LPDDR4X — на 4 ГБ OpenClaw работает уверенно, 8 ГБ даёт запас для одновременной работы нескольких навыков
- **Хранилище**: NVMe SSD через PCIe 2.0 (требуется M.2 HAT) — рекомендуется вместо microSD ради надёжности и скорости
- **USB 3.0**: достаточно быстро для внешних накопителей и периферии
- **Потребление**: ~5 Вт в режиме ожидания, ~12 Вт под нагрузкой — расходами на электричество можно пренебречь

Для стабильной работы стоит также приобрести:
- **Качественный USB-C блок питания** (рекомендуется 27 Вт PD — официальный блок питания Pi 5 подходит)
- **Активный кулер** (официальный вентилятор в корпусе Pi 5 или Pimoroni Pico HAT)
- **NVMe SSD объёмом 128 ГБ+** для ОС и данных OpenClaw

## Установка ОС: Ubuntu/Debian или Docker

### Вариант А: Raspberry Pi OS (Debian Bookworm, 64-бит)

Официальная 64-битная Raspberry Pi OS — наиболее простой путь:

```bash
# Прошивка через Raspberry Pi Imager
# Выберите: Raspberry Pi OS (64-bit) → ваше устройство хранения
# В расширенных настройках Imager включите SSH и задайте имя хоста
```

После первой загрузки обновите систему:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Вариант Б: Docker на Raspberry Pi OS

Если вы предпочитаете контейнерное развёртывание (проще обновлять, чище разделение окружений):

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Установка Docker Compose
sudo apt install -y docker-compose-plugin
```

## Установка OpenClaw на ARM64

Начиная с v1.2, OpenClaw полностью поддерживает ARM64 (aarch64). Вот конкретные шаги.

### Установка Node.js (через NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Должно отображаться v20.x.x
```

### Клонирование и установка OpenClaw

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install --production
cp .env.example .env
nano .env  # Добавьте API-ключи и настройки
```

### Развёртывание через Docker (альтернативный вариант)

```bash
# Загрузка и запуск через Docker Compose
wget https://raw.githubusercontent.com/openclaw/openclaw/main/docker-compose.yml
# Отредактируйте docker-compose.yml, добавив переменные окружения, затем:
docker compose up -d
```

### Запуск как системная служба

Чтобы OpenClaw автоматически запускался при загрузке:

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

## Оптимизация производительности

Pi 5 справляется с OpenClaw уверенно, но несколько настроек дают заметный эффект.

### Ограничение памяти Node.js

По умолчанию Node.js ограничивает размер кучи примерно 512 МБ. На Pi с 4 ГБ ОЗУ можно безопасно выделить больше:

```bash
# В .env или в строке Environment юнита systemd:
NODE_OPTIONS=--max-old-space-size=1024
```

На модели с 8 ГБ можно увеличить до 2048.

### Режим headless

Отключите графическое окружение рабочего стола, чтобы высвободить ~150 МБ ОЗУ и снизить простойную нагрузку на CPU:

```bash
sudo raspi-config
# → System Options → Boot / Auto Login → Console
```

### Настройка swap

Для модели с 4 ГБ рекомендуется добавить swap как страховку:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Установите CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### NVMe вместо microSD

Если ваша нагрузка предполагает активные операции чтения/записи базы данных (история диалогов OpenClaw, индексирование файлов), NVMe кардинально превосходит microSD. Используйте интерфейс PCIe Pi 5 с M.2 HAT для загрузки с NVMe.

## Идеи для применения

Когда OpenClaw запущен на Pi, возможности выходят далеко за рамки простого чата:

**Интеграция с Home Assistant**: используйте webhook-навык OpenClaw для запуска домашней автоматизации на естественном языке. «Выключи весь свет через 20 минут» становится голосовой командой, обрабатываемой локально.

**Управление локальными файлами**: направьте плагин File System Manager OpenClaw на ваш NAS или внешний диск. Спрашивайте «найди все PDF, изменённые в этом месяце» или «перемести фото из /Downloads в /Photos/2026».

**Приватный Q&A по документам**: запустите локально лёгкую модель эмбеддингов и используйте OpenClaw для ответов на вопросы по личным документам без отправки данных в облако.

**Мониторинг домашней сети**: расписание навыков OpenClaw для проверки доступности устройств, использования полосы пропускания или формирования ночных сводок статистики Pi-hole.

**Личный дневник и заметки**: поскольку OpenClaw работает 24/7, вы можете в любое время добавить заметку или голосовое сообщение со смартфона — они будут автоматически обработаны, помечены тегами и проиндексированы.

## Начните прямо сейчас

Raspberry Pi 5 — лучший одноплатный компьютер для самостоятельного хостинга OpenClaw в 2026 году. Менее чем за $100 на железо вы получаете приватный круглосуточный ИИ-шлюз, который действительно приносит пользу в повседневной жизни.

[Скачайте OpenClaw](https://openclaw.dev) и ознакомьтесь с документацией по установке на ARM64 — запустите вашего Pi-ассистента уже сегодня.
