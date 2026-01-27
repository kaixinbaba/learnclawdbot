"use client";

import Script from "next/script";

const AhrefsAnalytics = () => {
  return (
    <Script
      src="https://analytics.ahrefs.com/analytics.js"
      data-key="XnmGuS7oJFyPlp/Fm1q2Rw"
      async
      strategy="afterInteractive"
    />
  );
};

export default AhrefsAnalytics;
