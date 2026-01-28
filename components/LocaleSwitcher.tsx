"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Locale,
    LOCALE_NAMES,
    routing,
    usePathname,
    useRouter,
} from "@/i18n/routing";
import { useLocaleStore } from "@/stores/localeStore";
import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";

export default function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale();
  const { dismissLanguageAlert } = useLocaleStore();
  const [, startTransition] = useTransition();

  function onSelectChange(nextLocale: Locale) {
    dismissLanguageAlert();

    const { ...restParams } = params; // Copy params to avoid mutation if it's read-only
    
    // params usually contains 'locale' from next/navigation, which we don't want to pass back
    // as it might confuse next-intl's path generation or be redundant.
    // However, for dynamic routes, we do need the other params.
    // If we just pass pathname string, next-intl handles static routes fine.
    
    startTransition(() => {
      router.replace(
        pathname,
        { locale: nextLocale }
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="w-fit border-none bg-transparent dark:bg-transparent shadow-none p-0 focus:outline-none"
        aria-label="Select language"
      >
        <Languages className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={onSelectChange}>
          {routing.locales.map((cur) => (
            <DropdownMenuRadioItem key={cur} value={cur}>
              {LOCALE_NAMES[cur]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
