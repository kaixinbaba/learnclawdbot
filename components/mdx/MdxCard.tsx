import Link from "next/link";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  href?: string;
  disabled?: boolean;
}

export function MdxCard({
  href,
  className,
  children,
  disabled,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card text-card-foreground p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      {...props}
    >
      <div className="flex flex-col items-center text-center space-y-4 h-full">
        {children}
      </div>
      {href && (
        <Link
          href={disabled ? "#" : href}
          className="absolute inset-0"
          prefetch={false}
        >
          <span className="sr-only">View Integration</span>
        </Link>
      )}
    </div>
  );
}
