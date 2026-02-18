"use client";

import { cn } from "@/lib/utils";
import { Tag } from "@/types/cms";

interface TagSelectorProps {
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}

export function TagSelector({
  tags,
  selectedTagId,
  onSelectTag,
}: TagSelectorProps) {
  // Temporarily disabled: only show "All" button
  // TODO: Re-enable tag filtering after fixing Preview environment issues
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      <button
        onClick={() => onSelectTag(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground"
        )}
      >
        All
      </button>
    </div>
  );
}
