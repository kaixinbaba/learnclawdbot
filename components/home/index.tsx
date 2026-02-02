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
      <TimelineClient locale={locale} />
    </div>
  );
}
