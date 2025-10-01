"use client";

import type React from "react";
import { Provider } from "jotai";
import { ComposeModalProvider } from "@/providers/ComposeModalProvider";
import { OrganizationProvider } from "@/providers/OrganizationProvider";
import { jotaiStore } from "@/store";
import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders(props: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <Provider store={jotaiStore}>
        <OrganizationProvider>
          <ComposeModalProvider>{props.children}</ComposeModalProvider>
        </OrganizationProvider>
      </Provider>
    </ThemeProvider>
  );
}
