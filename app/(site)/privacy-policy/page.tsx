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
                This website minimizes the collection of personal data. We do not
                require user registration for most features.
              </p>
              <p className="mb-3">
                If you subscribe to our newsletter or contact us via our form, we
                collect your email address and any other information you provide
                voluntarily to respond to your request.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Cookies and Advertising</h2>
              <p className="mb-3">
                This website uses cookies to enhance your experience and to serve
                relevant advertisements.
              </p>
              <h3 className="mb-2 font-medium">Google AdSense</h3>
              <p className="mb-3">
                Third-party vendors, including Google, use cookies to serve ads based
                on a user's prior visits to your website or other websites.
              </p>
              <p className="mb-3">
                Google's use of advertising cookies enables it and its partners to
                serve ads to your users based on their visit to your sites and/or
                other sites on the Internet.
              </p>
              <p className="mb-3">
                Users may opt out of personalized advertising by visiting{" "}
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Ads Settings
                </a>
                . Alternatively, you can opt out of a third-party vendor's use of
                cookies for personalized advertising by visiting{" "}
                <a
                  href="https://www.aboutads.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.aboutads.info
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Third-Party Services</h2>
              <p className="mb-3">
                This website uses basic analytics services (such as Google Analytics
                or Plausible) to understand general traffic patterns. These services
                collect anonymous, aggregated data only.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">GDPR and CCPA Compliance</h2>
              <p className="mb-3">
                We respect your privacy rights. If you are a resident of the European
                Economic Area (EEA) or California, you have certain data protection
                rights.
              </p>
              <p className="mb-3">
                Even though we do not collect personal identifiable information
                directly from most users, our third-party partners (like Google
                Analytics and AdSense) may collect data as described in their
                respective policies.
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
                We may update our Privacy Policy from time to time. We will notify
                you of any changes by posting the new Privacy Policy on this page.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">Contact</h2>
              <p className="mb-3">
                If you have any questions about this Privacy Policy, please visit our
                <Link href="/contact" className="text-primary hover:underline mx-1">Contact Page</Link>
                or our <Link href="/about" className="text-primary hover:underline mx-1">About Page</Link>
                for more information.
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
