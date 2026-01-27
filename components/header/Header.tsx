import HeaderLinks from "@/components/header/HeaderLinks";
import MobileMenu from "@/components/header/MobileMenu";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Link as I18nLink } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

const Header = async () => {
  const t = await getTranslations("Home");

  return (
    <header className="py-2 backdrop-blur-md sticky top-0 z-50">
      <nav className="flex justify-between items-center container max-w-8xl mx-auto">
        <div className="flex items-center space-x-6 md:space-x-12">
          <I18nLink
            href="/"
            title={t("title")}
            prefetch={true}
            className="flex items-center space-x-1"
          >
            <Image src="/logo.png" alt="Logo" width={28} height={28} />
            <span
              className={cn(
                "text-xl font-semibold text-primary font-science-gothic"
              )}
            >
              {t("title")}
            </span>
          </I18nLink>

          <HeaderLinks />
        </div>

        <div className="flex items-center gap-x-2 flex-1 justify-end">
          {/* PC */}
          <div className="hidden lg:flex items-center gap-x-2">
            <LocaleSwitcher />
          </div>

          {/* Mobile */}
          <div className="flex lg:hidden items-center gap-x-2">
            <MobileMenu />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
