"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// 只有需要时才加载 CrispChat
const CrispChat = dynamic(() => import("./CrispChat"), { ssr: false });

/**
 * 延迟加载 Crisp Chat
 * - 用户滚动或交互后才加载
 * - 或者 5 秒后自动加载
 */
export default function DeferredCrispChat() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const loadCrisp = () => {
      setShouldLoad(true);
    };

    // 监听用户交互
    const events = ["scroll", "mousemove", "touchstart", "keydown"];
    const handleInteraction = () => {
      events.forEach((event) => window.removeEventListener(event, handleInteraction));
      loadCrisp();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleInteraction, { once: true, passive: true });
    });

    // 5秒后强制加载
    const timer = setTimeout(loadCrisp, 5000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleInteraction));
      clearTimeout(timer);
    };
  }, []);

  if (!shouldLoad) {
    return null;
  }

  return <CrispChat />;
}
