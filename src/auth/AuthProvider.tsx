"use client";

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { ReactNode } from "react";

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "your-client-id",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "common"}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
};