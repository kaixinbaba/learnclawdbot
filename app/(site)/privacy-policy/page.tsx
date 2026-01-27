import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site";
import { constructMetadata } from "@/lib/metadata";
import { HomeIcon } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Privacy Policy",
    description: `Privacy Policy for ${siteConfig.name}.`,
    path: `/privacy-policy`,
    locale: "en",
    availableLocales: ["en"],
  });
}

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-secondary/20 py-8 sm:py-12">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="bg-background rounded-xl border p-6 shadow-xs sm:p-8 dark:border-zinc-800">
          <h1 className="mb-6 text-2xl font-bold sm:text-3xl">
            Privacy Policy
          </h1>

          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-xl font-semibold">Data Collection</h2>
              <p className="mb-3">
                This website does not collect personal data.
              </p>
              <p className="mb-3">
                We do not require user registration, do not use cookies for tracking,
                and do not collect any personally identifiable information.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Third-Party Services</h2>
              <p className="mb-3">
                This website may use basic analytics services to understand general
                traffic patterns. These services collect anonymous, aggregated data only.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">External Links</h2>
              <p className="mb-3">
                This website may contain links to external sites. We are not responsible
                for the privacy practices of other websites.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Changes to This Policy</h2>
              <p className="mb-3">
                If this changes in the future, this page will be updated accordingly.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Contact</h2>
              <p className="mb-3">
                If you have any questions about this Privacy Policy, please visit our
                About page for more information.
              </p>
            </section>
          </div>

          <Separator className="my-6" />

          <div>
            <Link
              href="/"
              className="text-primary hover:underline flex items-center gap-2"
              title="Return to Home"
            >
              <HomeIcon className="size-4" /> Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
