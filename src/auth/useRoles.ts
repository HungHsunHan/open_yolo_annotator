"use client";

import { useMsal } from "@azure/msal-react";

export const useRoles = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  
  const getRoles = (): string[] => {
    return account?.idTokenClaims?.roles || [];
  };

  const hasRole = (role: string): boolean => {
    return getRoles().includes(role);
  };

  return { getRoles, hasRole };
};