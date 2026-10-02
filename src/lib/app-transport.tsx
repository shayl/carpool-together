"use client";

import { createContext, useContext } from "react";

export type AppTransport = ({
  preview: false;
} | {
  preview: true;
  refresh: () => Promise<void>;
}) & {
  request: (url: string, init?: RequestInit) => Promise<Response>;
};

export const AppTransportContext = createContext<AppTransport>({
  preview: false,
  request: (url, init) => fetch(url, init),
});

export function useAppTransport() {
  return useContext(AppTransportContext);
}
