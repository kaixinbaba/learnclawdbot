import { SiteConfig } from "@/types/siteConfig";

export const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://learnclawdbot.org";

export const siteConfig: SiteConfig = {
  name: "Learn OpenClaw",
  url: BASE_URL,
  authors: [
    {
      name: "Learn OpenClaw Team",
      url: BASE_URL,
    },
  ],
  creator: "@learnopenclaw",
  socialLinks: {
    github: "https://github.com/openclaw/openclaw",
  },
  themeColors: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  defaultNextTheme: "dark", // next-theme option: system | dark | light
  icons: {
    icon: "/favicon.ico",
    shortcut: "/logo.png",
    apple: "/logo.png", // apple-touch-icon.png
  },
};
