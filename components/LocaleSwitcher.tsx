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
    UI_LOCALES,
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

  function onSelectChange(value: string) {
    const nextLocale = value as Locale;
    dismissLanguageAlert();

    startTransition(() => {
      // @ts-expect-error -- TypeScript might complain about params not matching
      router.replace({ pathname, params }, { locale: nextLocale });
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
          {UI_LOCALES.map((cur) => (
            <DropdownMenuRadioItem key={cur} value={cur}>
              {LOCALE_NAMES[cur]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
