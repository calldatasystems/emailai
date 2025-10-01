import type { Metadata } from "next";
import { TermsContent } from "@/app/(landing)/terms/content";

export const metadata: Metadata = {
  title: "Terms of Service - EmailAI",
  description: "Terms of Service - EmailAI",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <TermsContent />;
}
