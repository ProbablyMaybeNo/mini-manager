import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy · The Mini Mainframe",
  description: "How The Mini Mainframe handles your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="PRIVACY POLICY"
      updated="June 2026"
      intro="The Mini Mainframe is a hobby paint-and-miniature management tool. This policy explains what we collect, why, and the choices you have. We aim to collect as little as possible."
      sections={[
        {
          heading: "What we collect",
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Account: your username and a password (stored only as a salted hash), plus an optional recovery email.</li>
              <li>Your content: projects, recipes, paint inventory, collection items, sessions, and events you create.</li>
              <li>Billing: if you subscribe, Stripe processes your payment; we store your Stripe customer id and plan status, never your card details.</li>
              <li>Basic technical logs needed to run and secure the service.</li>
            </ul>
          ),
        },
        {
          heading: "How we use it",
          body: "To provide the app, authenticate you, process payments, send account emails (e.g. password resets), and keep the service secure. We do not sell your data.",
        },
        {
          heading: "Third parties",
          body: "We use Vercel (hosting), our database provider, Stripe (payments), and an email provider for transactional email. Each processes data only to provide their service.",
        },
        {
          heading: "Your choices",
          body: "You can export all of your data from Settings at any time, and you can delete your account to remove your content. Email us to exercise any data rights.",
        },
        {
          heading: "Contact",
          body: "Questions about privacy? Contact the operator at the email listed on the site.",
        },
      ]}
    />
  );
}
