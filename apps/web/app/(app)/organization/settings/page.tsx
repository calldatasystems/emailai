import { Suspense } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { redirect } from "next/navigation";
import { OrganizationSettingsContent } from "./OrganizationSettingsContent";

export default async function OrganizationSettingsPage() {
  const session = await auth();

  if (!session?.user.id) {
    redirect("/login");
  }

  if (!session.organizationId) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            No organization context found. Please sign out and sign in again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <OrganizationSettingsContent />
    </Suspense>
  );
}
