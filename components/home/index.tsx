import Hero from "@/components/home/Hero";
import TimelineClient from "@/app/[locale]/(basic-layout)/openclaw-development-timeline/TimelineClient";
import { BG1 } from "@/components/shared/BGs";
import { getMessages } from "next-intl/server";

export default async function HomeComponent({ locale }: { locale: string }) {
  const messages = await getMessages();

  return (
    <div className="w-full">
      <BG1 />

      {messages.Landing.Hero && <Hero />}

      {/* Scroll hint for timeline discovery */}
      <div className="text-center py-12 animate-bounce">
        <div className="flex flex-col items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium">
            ↓ Scroll down to see OpenClaw development timeline
          </span>
          <svg
            className="w-6 h-6 text-muted-foreground/60"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </div>

      <TimelineClient locale={locale} />
    </div>
  );
}
