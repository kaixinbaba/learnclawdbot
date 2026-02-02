import { Aside } from "@/components/mdx/Aside";
import { Callout } from "@/components/mdx/Callout";
import CodeBlock from "@/components/mdx/CodeBlock";
import { MdxCard } from "@/components/mdx/MdxCard";
import React, { ReactNode } from "react";

// Callout-style components (Info, Warning, Tip, Note, Danger)
const InfoBox: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="my-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-300">
    {children}
  </div>
);

const WarningBox: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="my-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
    {children}
  </div>
);

const TipBox: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="my-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-sm text-green-800 dark:text-green-300">
    {children}
  </div>
);

// CardGroup: renders children in a grid
const CardGroup: React.FC<{ children: ReactNode; cols?: number }> = ({ children, cols = 2 }) => (
  <div className={`grid gap-4 my-6 grid-cols-1 md:grid-cols-${cols}`}>
    {children}
  </div>
);

// Steps / Step
const Steps: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="my-6 space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-6">
    {children}
  </div>
);

const StepItem: React.FC<{ children: ReactNode; title?: string }> = ({ children, title }) => (
  <div className="relative">
    {title && <h4 className="font-semibold mb-2">{title}</h4>}
    {children}
  </div>
);

interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  className: string;
  children: ReactNode;
}

const Heading: React.FC<HeadingProps> = ({ level, className, children }) => {
  const HeadingTag = `h${level}` as keyof React.ElementType;
  const headingId = children?.toString() ?? "";

  return React.createElement(
    HeadingTag,
    { id: headingId, className },
    children
  );
};

interface MDXComponentsProps {
  [key: string]: React.FC<any>;
}

const MDXComponents: MDXComponentsProps = {
  h1: (props) => (
    <Heading level={1} className="text-4xl font-bold mt-8 mb-6" {...props} />
  ),
  h2: (props) => (
    <Heading
      level={2}
      className="text-3xl font-semibold mt-8 mb-6 border-b-2 border-gray-200 pb-2"
      {...props}
    />
  ),
  h3: (props) => (
    <Heading
      level={3}
      className="text-2xl font-semibold mt-6 mb-4"
      {...props}
    />
  ),
  h4: (props) => (
    <Heading level={4} className="text-xl font-semibold mt-6 mb-4" {...props} />
  ),
  h5: (props) => (
    <Heading level={5} className="text-lg font-semibold mt-6 mb-4" {...props} />
  ),
  h6: (props) => (
    <Heading
      level={6}
      className="text-base font-semibold mt-6 mb-4"
      {...props}
    />
  ),
  hr: (props) => <hr className="border-t border-gray-200 my-8" {...props} />,
  p: (props) => (
    <p
      className="my-3 leading-relaxed text-gray-700 dark:text-gray-300"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors underline underline-offset-4"
      target="_blank"
      {...props}
    />
  ),
  ul: (props) => <ul className="list-disc pl-6 mt-0 mb-6" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mt-0 mb-6" {...props} />,
  li: (props) => (
    <li className="mb-3 text-gray-700 dark:text-gray-300" {...props} />
  ),
  code: (props) => (
    <span
      className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 font-mono text-sm"
      {...props}
    />
  ),
  pre: (props) => {
    const preStyles =
      "rounded-lg p-3 overflow-x-auto my-4 bg-gray-100 dark:bg-gray-800";
    return (
      <CodeBlock
        {...props}
        className={`${props.className || ""} ${preStyles}`.trim()}
      />
    );
  },
  blockquote: (props) => (
    <blockquote
      className="pl-6 border-l-4 my-6 text-gray-600 dark:text-gray-400 italic"
      {...props}
    />
  ),
  img: (props) => (
    <img className="rounded-lg border-2 border-gray-200 my-6" {...props} />
  ),
  strong: (props) => <strong className="font-bold" {...props} />,
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table
        className="w-full border-collapse table-fixed overflow-hidden m-0"
        {...props}
      />
    </div>
  ),
  thead: (props) => <thead {...props} />,
  tbody: (props) => <tbody {...props} />,
  tr: (props) => <tr {...props} />,
  th: (props) => (
    <th
      className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-left font-bold min-w-[1em] box-border relative align-top [[align=center]]:text-center [[align=right]]:text-right"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border border-gray-200 dark:border-gray-700 px-2 py-1.5 min-w-[1em] box-border relative align-top [[align=center]]:text-center [[align=right]]:text-right"
      {...props}
    />
  ),
  Aside,
  Callout,
  Card: MdxCard,
  CardGroup,
  Info: InfoBox,
  Warning: WarningBox,
  Tip: TipBox,
  Note: InfoBox,
  Danger: WarningBox,
  Steps,
  Step: StepItem,
};

// Wrap MDXComponents with a Proxy to gracefully handle undefined components
// instead of throwing "Expected component X to be defined"
const SafeMDXComponents = new Proxy(MDXComponents, {
  get(target, prop: string) {
    if (prop in target) {
      return target[prop];
    }
    // Return a passthrough component for unknown tags
    const Fallback: React.FC<{ children?: ReactNode }> = ({ children }) => <>{children}</>;
    Fallback.displayName = `MDXFallback(${prop})`;
    return Fallback;
  },
});

export default SafeMDXComponents;
