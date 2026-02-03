import { SiteConfig } from "@/types/siteConfig";

// Always use www version for canonical URLs to avoid 301 redirect chains
// (learnclawdbot.org → www.learnclawdbot.org causes SEO issues)
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.learnclawdbot.org";
export const BASE_URL = rawUrl.includes("learnclawdbot.org") && !rawUrl.includes("www.")
  ? rawUrl.replace("://learnclawdbot.org", "://www.learnclawdbot.org")
  : rawUrl;

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
