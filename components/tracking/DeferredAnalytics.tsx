"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// 延迟加载分析组件
const GoogleAnalytics = dynamic(() => import("./GoogleAnalytics"), { ssr: false });
const MicrosoftClarity = dynamic(() => import("./MicrosoftClarity"), { ssr: false });
const AhrefsAnalytics = dynamic(() => import("./AhrefsAnalytics"), { ssr: false });

/**
 * 延迟加载分析脚本
 * - 等待页面空闲后再加载
 * - 移动端延迟更长，优先保证首屏性能
 */
const DeferredAnalytics = () => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // 使用 requestIdleCallback 或 setTimeout 延迟加载
    const loadAnalytics = () => {
      setShouldLoad(true);
    };

    if ("requestIdleCallback" in window) {
      // 浏览器空闲时加载
      const id = window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    } else {
      // 降级方案：2秒后加载
      const timer = setTimeout(loadAnalytics, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldLoad) {
    return null;
  }

  return (
    <>
      <GoogleAnalytics />
      <MicrosoftClarity />
      <AhrefsAnalytics />
    </>
  );
};

export default DeferredAnalytics;
