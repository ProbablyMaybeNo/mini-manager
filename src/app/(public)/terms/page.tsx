import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Terms of Service · The Mini Mainframe",
  description: "The terms for using The Mini Mainframe.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="TERMS OF SERVICE"
      updated="June 2026"
      intro="By creating an account or using The Mini Mainframe you agree to these terms. If you don't agree, please don't use the service."
      sections={[
        {
          heading: "Your account",
          body: "You're responsible for your account and for keeping your password secure. Don't misuse the service, attempt to break it, or use it to infringe others' rights.",
        },
        {
          heading: "Your content",
          body: "You own the projects, recipes, and other content you create. You grant us the limited rights needed to store and display it back to you as part of running the service.",
        },
        {
          heading: "Plans & billing",
          body: "The base app is usable without a subscription; the tools and AI features are a monthly subscription described on the pricing page. Subscriptions renew until cancelled. Payments are handled by Stripe. Prices and what's included may change with notice.",
        },
        {
          heading: "Availability",
          body: "The service is provided “as is”, without warranty. We work to keep it available and your data safe, but we can't guarantee uninterrupted service. Keep your own backups via the export feature.",
        },
        {
          heading: "Termination",
          body: "You can stop using the service and delete your account at any time. We may suspend accounts that violate these terms.",
        },
        {
          heading: "Changes",
          body: "We may update these terms; continued use after an update means you accept the changes.",
        },
        {
          heading: "Contact",
          body: (
            <>
              Questions about these terms? Email us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </>
          ),
        },
      ]}
    />
  );
}
