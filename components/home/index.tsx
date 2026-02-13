import Hero from "@/components/home/Hero";
import TimelineClient from "@/app/[locale]/(basic-layout)/openclaw-development-timeline/TimelineClient";
import { BG1 } from "@/components/shared/BGs";
import { getMessages } from "next-intl/server";

export default async function HomeComponent({ locale }: { locale: string }) {
  const messages = await getMessages();

  return (
    <div className="w-full">
      <BG1 />

      {/* First screen wrapper - full viewport height with scroll hint at bottom */}
      <div className="min-h-screen relative flex flex-col">
        {messages.Landing.Hero && <Hero />}
        
        {/* Scroll hint fixed at bottom of first screen */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center animate-bounce z-10">
          <div className="flex flex-col items-center gap-1 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-border/50">
            <span className="text-muted-foreground text-xs font-medium">
              ↓ Scroll for timeline
            </span>
            <svg
              className="w-4 h-4 text-muted-foreground/60"
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
      </div>

      <TimelineClient locale={locale} />
    </div>
  );
}
