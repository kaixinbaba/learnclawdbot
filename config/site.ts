import { SiteConfig } from "@/types/siteConfig";

export const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://learnmoltbot.com";

export const siteConfig: SiteConfig = {
  name: "Learn Moltbot",
  url: BASE_URL,
  authors: [
    {
      name: "Learn Moltbot Team",
      url: BASE_URL,
    }
  ],
  creator: '@learnmoltbot',
  socialLinks: {
    github: "https://github.com/moltbot/clawdbot",
  },
  themeColors: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  defaultNextTheme: 'light', // next-theme option: system | dark | light
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo.png",
    apple: "/logo.png", // apple-touch-icon.png
  },
}
