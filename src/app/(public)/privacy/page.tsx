import type { Metadata } from "next";
import { LegalDoc } from "@/components/public/LegalDoc";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Privacy Policy · The Mini Mainframe",
  description: "How The Mini Mainframe handles your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="PRIVACY POLICY"
      updated="July 2026"
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
          body: "To provide the app, authenticate you, process payments, send account emails (e.g. password resets), and keep the service secure. Some optional features send the input you provide to the AI subprocessors listed below. We do not sell your data.",
        },
        {
          heading: "Third parties (subprocessors)",
          body: (
            <>
              <p className="mb-2">
                We share data with the following subprocessors, each only to
                provide their part of the service:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Vercel — hosting, and Vercel Analytics for privacy-friendly, aggregate usage metrics.</li>
                <li>Our database provider — stores your account and content.</li>
                <li>Stripe — payments (if you subscribe).</li>
                <li>An email provider — transactional email (e.g. password resets, verification).</li>
                <li>Anthropic — powers our AI features: the prompts you send to the AI recipe creator, and the images you submit to the public gallery (which are checked by automated moderation).</li>
                <li>Groq — parses the army-list text you upload when importing a list.</li>
              </ul>
              <p className="mt-2">
                Each processes data only to provide their service. The AI
                subprocessors (Anthropic, Groq) receive data only when you use
                the optional feature that relies on them.
              </p>
            </>
          ),
        },
        {
          heading: "Your choices",
          body: "You can export all of your data from Settings at any time, and you can delete your account to remove your content. Email us to exercise any data rights.",
        },
        {
          heading: "Contact",
          body: (
            <>
              Questions about privacy, or want to exercise a data right? Email us
              at{" "}
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
