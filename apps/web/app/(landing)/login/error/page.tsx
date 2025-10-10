"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BasicLayout } from "@/components/layouts/BasicLayout";
import { ErrorPage } from "@/components/ErrorPage";
import { env } from "@/env";
import { useUser } from "@/hooks/useUser";
import { LoadingContent } from "@/components/LoadingContent";
import { Loading } from "@/components/Loading";

export default function LogInErrorPage() {
  const { data, isLoading, error } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  // For some reason users are being sent to this page when logged in
  // This will redirect them out of this page to the app
  useEffect(() => {
    if (data?.id) {
      router.push("/welcome");
    }
  }, [data, router]);

  if (isLoading) return <Loading />;
  // will redirect to /welcome if user is logged in
  if (data?.id) return <Loading />;

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "Access was denied. You may have cancelled the sign-in.",
    Verification:
      "The verification token has expired or has already been used.",
    OAuthSignin: "Error in constructing an authorization URL.",
    OAuthCallback: "Error in handling the response from the OAuth provider.",
    OAuthCreateAccount: "Could not create OAuth provider user in the database.",
    EmailCreateAccount: "Could not create email provider user in the database.",
    Callback: "Error in the OAuth callback handler route.",
    OAuthAccountNotLinked: "Email is already associated with another account.",
    SessionRequired: "Please sign in to access this page.",
    Default: "Unable to sign in.",
  };

  const errorDescription = authError
    ? errorMessages[authError] || errorMessages.Default
    : "There was an error logging in to the app.";

  return (
    <BasicLayout>
      <LoadingContent loading={isLoading} error={error}>
        <ErrorPage
          title="Error Logging In"
          description={
            <div>
              <p>{errorDescription}</p>
              {authError && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Error code: {authError}
                </p>
              )}
              <p className="mt-4">
                Please try logging in again. If this error persists, contact
                support at {env.NEXT_PUBLIC_SUPPORT_EMAIL}.
              </p>
            </div>
          }
          button={
            <Button asChild>
              <Link href="/login">Log In</Link>
            </Button>
          }
        />
        {/* <AutoLogOut loggedIn={!!session?.user.email} /> */}
      </LoadingContent>
    </BasicLayout>
  );
}
