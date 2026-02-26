import type { Locale } from "@/i18n/routing";

type TagI18nMap = Record<string, Partial<Record<Locale, string>>>;

// IMPORTANT:
// - DB keeps tag names in English.
// - Frontend uses this mapping layer to render localized labels.
// - Fallback: return original English name when not found.
const TAG_LABELS: TagI18nMap = {
  "Beginner Basics": {
    zh: "新手基础",
    ja: "初心者の基礎",
    ko: "초보자 기초",
    ru: "Основы для новичков",
  },
  "Configuration & Manifest": {
    zh: "配置与清单",
    ja: "設定とマニフェスト",
    ko: "구성 및 매니페스트",
    ru: "Конфигурация и манифест",
  },
  "Channel Integrations": {
    zh: "渠道集成",
    ja: "チャネル連携",
    ko: "채널 통합",
    ru: "Интеграции каналов",
  },
  "Multi-Agent & Browser": {
    zh: "多智能体与浏览器",
    ja: "マルチエージェント＆ブラウザ",
    ko: "멀티 에이전트 및 브라우저",
    ru: "Мультиагентность и браузер",
  },
  "Voice & Audio": {
    zh: "语音与音频",
    ja: "音声とオーディオ",
    ko: "음성 및 오디오",
    ru: "Голос и аудио",
  },
  "Reliability & Performance": {
    zh: "稳定性与性能",
    ja: "信頼性とパフォーマンス",
    ko: "안정성 및 성능",
    ru: "Надёжность и производительность",
  },
  "User Cases": {
    zh: "用户案例",
    ja: "ユーザー事例",
    ko: "사용자 사례",
    ru: "Пользовательские кейсы",
  },
  "Deployment & Infrastructure": {
    zh: "部署与基础设施",
    ja: "デプロイとインフラ",
    ko: "배포 및 인프라",
    ru: "Развертывание и инфраструктура",
  },
  "Automation & Workflows": {
    zh: "自动化与工作流",
    ja: "自動化とワークフロー",
    ko: "자동화 및 워크플로",
    ru: "Автоматизация и рабочие процессы",
  },
};

const ALL_LABELS: Partial<Record<Locale, string>> = {
  en: "All",
  zh: "全部",
  ja: "すべて",
  ko: "전체",
  ru: "Все",
};

export function getTagDisplayName(tagName: string, locale: Locale): string {
  if (!tagName) return tagName;
  return TAG_LABELS[tagName]?.[locale] ?? tagName;
}

export function getAllTagDisplayName(locale: Locale): string {
  return ALL_LABELS[locale] ?? "All";
}
