"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// 动态加载 Timeline，不阻塞首屏
const TimelineClient = dynamic(
  () => import("@/app/[locale]/(basic-layout)/openclaw-development-timeline/TimelineClient"),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading timeline...</div>
      </div>
    )
  }
);

interface DeferredTimelineProps {
  locale: string;
}

/**
 * 延迟加载 Timeline
 * - 用户滚动到视口内或接近时才加载
 * - 减少首屏 JS 负担
 */
export default function DeferredTimeline({ locale }: DeferredTimelineProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // 使用 IntersectionObserver 检测是否接近视口
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: "200px", // 提前 200px 开始加载
        threshold: 0 
      }
    );

    const target = document.getElementById("timeline-trigger");
    if (target) {
      observer.observe(target);
    }

    // 3秒后强制加载（以防用户不滚动）
    const timer = setTimeout(() => setShouldLoad(true), 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div id="timeline-trigger" className="h-1" />
      {shouldLoad && <TimelineClient locale={locale} />}
    </>
  );
}
