"use client";

import type { Locale } from "@/i18n/routing";
import { getAllTagDisplayName, getTagDisplayName } from "@/lib/tag-i18n";
import { cn } from "@/lib/utils";
import { Tag } from "@/types/cms";

interface TagSelectorProps {
  tags: Tag[];
  locale: Locale;
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
}

export function TagSelector({
  tags,
  locale,
  selectedTagId,
  onSelectTag,
}: TagSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
          selectedTagId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground hover:bg-muted/80"
        )}
      >
        {getAllTagDisplayName(locale)}
      </button>

      {tags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        const label = getTagDisplayName(tag.name, locale);

        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(tag.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
