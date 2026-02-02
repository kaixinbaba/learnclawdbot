"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { 
  Rocket, 
  Layers, 
  Globe, 
  Shield, 
  Zap, 
  Palette, 
  CheckCircle,
  GitBranch,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import enTimelineData from "@/data/timeline/en.json";
import zhTimelineData from "@/data/timeline/zh.json";
import jaTimelineData from "@/data/timeline/ja.json";

// Icon mapping based on category
const categoryIcons = {
  launch: Rocket,
  architecture: Layers,
  feature: Zap,
  security: Shield,
  ui: Palette,
  improvement: CheckCircle,
  integration: Globe,
  rebrand: Sparkles,
};

// Color scheme based on category
const categoryColors = {
  launch: "from-purple-500 to-pink-500",
  architecture: "from-blue-500 to-cyan-500",
  feature: "from-yellow-500 to-orange-500",
  security: "from-red-500 to-pink-500",
  ui: "from-green-500 to-teal-500",
  improvement: "from-indigo-500 to-purple-500",
  integration: "from-cyan-500 to-blue-500",
  rebrand: "from-pink-500 to-rose-500",
};

interface TimelineNode {
  id: string;
  type: "milestone" | "major" | "release";
  date: string;
  version: string;
  title: string;
  description: string;
  highlights: string[];
  category: keyof typeof categoryIcons;
  impact: "high" | "medium" | "low";
}

function TimelineNode({ 
  node, 
  index, 
  locale 
}: { 
  node: TimelineNode; 
  index: number;
  locale: string;
}) {
  const [ref, inView] = useInView({
    threshold: 0.3,
    triggerOnce: true,
  });

  const Icon = categoryIcons[node.category] || GitBranch;
  const isMajor = node.type === "milestone" || node.impact === "high";

  // Format date based on locale
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    if (locale === "zh") {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } else if (locale === "ja") {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } else {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.1 }}
      className={`relative flex ${
        index % 2 === 0 ? "flex-row" : "flex-row-reverse"
      } items-center gap-8 mb-16 lg:mb-24`}
    >
      {/* Content Card */}
      <div className={`flex-1 ${index % 2 === 0 ? "text-right" : "text-left"}`}>
        <motion.div
          whileHover={{ scale: isMajor ? 1.02 : 1.01 }}
          className={`
            relative overflow-hidden rounded-2xl p-6 lg:p-8
            ${isMajor ? "bg-gradient-to-br shadow-2xl" : "bg-white/50 dark:bg-gray-800/50 shadow-lg"}
            ${isMajor ? categoryColors[node.category] : ""}
            backdrop-blur-sm border border-gray-200 dark:border-gray-700
          `}
        >
          {isMajor && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
          )}
          
          <div className="relative z-10">
            <div className={`flex items-center gap-3 mb-3 ${index % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <span className={`text-sm font-mono px-3 py-1 rounded-full ${
                isMajor ? "bg-white/30 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}>
                {node.version}
              </span>
              <span className={`text-xs ${isMajor ? "text-white/80" : "text-gray-500"}`}>
                {formatDate(node.date)}
              </span>
            </div>

            <h3 className={`text-2xl lg:text-3xl font-bold mb-3 ${
              isMajor ? "text-white" : "text-gray-900 dark:text-white"
            }`}>
              {node.title}
            </h3>

            <p className={`text-base lg:text-lg mb-4 ${
              isMajor ? "text-white/90" : "text-gray-600 dark:text-gray-300"
            }`}>
              {node.description}
            </p>

            <ul className="space-y-2">
              {node.highlights.map((highlight, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: index % 2 === 0 ? 20 : -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                  className={`flex items-start gap-2 text-sm lg:text-base ${
                    index % 2 === 0 ? "flex-row-reverse text-right" : "flex-row text-left"
                  }`}
                >
                  <span className={`mt-1 ${isMajor ? "text-white/80" : "text-gray-500"}`}>•</span>
                  <span className={isMajor ? "text-white/90" : "text-gray-700 dark:text-gray-300"}>
                    {highlight}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Center Icon */}
      <div className="flex-shrink-0 relative z-20">
        <motion.div
          whileHover={{ scale: 1.2, rotate: 360 }}
          transition={{ duration: 0.6 }}
          className={`
            w-16 h-16 lg:w-20 lg:h-20 rounded-full
            flex items-center justify-center
            ${isMajor ? `bg-gradient-to-br ${categoryColors[node.category]} shadow-2xl` : "bg-white dark:bg-gray-800 shadow-lg"}
            border-4 border-white dark:border-gray-900
          `}
        >
          <Icon className={`w-8 h-8 lg:w-10 lg:h-10 ${isMajor ? "text-white" : "text-gray-700 dark:text-gray-300"}`} />
        </motion.div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />
    </motion.div>
  );
}

export default function TimelineClient({ locale }: { locale: string }) {
  const { scrollYProgress } = useScroll();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Timeline");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Background color transitions based on scroll
  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    [
      "rgb(15, 23, 42)", // Dark slate (early)
      "rgb(30, 41, 59)", // Slate (mid)
      "rgb(51, 65, 85)", // Light slate (later)
      "rgb(71, 85, 105)", // Lightest (recent)
    ]
  );

  // Load timeline data based on locale
  const getTimelineData = () => {
    switch (locale) {
      case "zh":
        return zhTimelineData;
      case "ja":
        return jaTimelineData;
      default:
        return enTimelineData;
    }
  };

  const nodes = getTimelineData() as TimelineNode[];

  if (!mounted) {
    return null;
  }

  return (
    <motion.div 
      style={{ backgroundColor }}
      className="min-h-screen transition-colors duration-1000"
    >
      {/* Hero Section */}
      <div className="container max-w-7xl mx-auto px-4 py-16 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16 lg:mb-24"
        >
          <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6">
            {t("hero.title")}
          </h1>
          <p className="text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto">
            {t("hero.subtitle")}
          </p>
        </motion.div>

        {/* Timeline Line */}
        <div className="relative">
          <motion.div
            className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-blue-500 to-cyan-500 -translate-x-1/2"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ transformOrigin: "top" }}
          />

          {/* Timeline Nodes */}
          <div className="relative">
            {nodes.map((node, index) => (
              <TimelineNode key={node.id} node={node} index={index} locale={locale} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-center mt-16 lg:mt-24 pb-16"
        >
          <p className="text-gray-400 text-lg">
            {t("footer.text")}{" "}
            <a
              href="https://github.com/openclaw/openclaw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              {t("footer.linkText")}
            </a>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
