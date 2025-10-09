import { redirectToEmailAccountPath } from "@/utils/account";

export default async function ReplyAIPage() {
  await redirectToEmailAccountPath("/reply-ai");
}
