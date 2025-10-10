import { Suspense } from "react";
import type { Metadata } from "next";
import { Hero } from "@/app/(landing)/home/Hero";
import { FeaturesReplyAI } from "@/app/(landing)/home/Features";
import { Testimonials } from "@/app/(landing)/home/Testimonials";
import { Pricing } from "@/app/(app)/premium/Pricing";
import { FAQs } from "@/app/(landing)/home/FAQs";
import { CTA } from "@/app/(landing)/home/CTA";
import { BasicLayout } from "@/components/layouts/BasicLayout";

export const metadata: Metadata = {
  title: "ReplyAI | Track what needs a reply with AI",
  description:
    "ReplyAI uses AI to identify the emails that need a reply, and who hasn't responded yet.",
  alternates: { canonical: "/reply-ai" },
};

export default function ReplyAI() {
  return (
    <BasicLayout>
      <Hero
        title="ReplyAI: Never miss a reply"
        subtitle="Most emails don't need a reply — ReplyAI surfaces the ones that do. We'll track what you need to reply to, and who to follow up with."
      />
      <FeaturesReplyAI />
      <Testimonials />
      <Suspense>
        <div className="pb-32">
          <Pricing />
        </div>
      </Suspense>
      <FAQs />
      <CTA />
    </BasicLayout>
  );
}
