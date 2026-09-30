import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { CanonicalLocalOrigin } from "@/components/canonical-local-origin";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { LanguageProvider } from "@/lib/i18n";
import { themeBootstrapScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carpool Together",
  description: "Private, multi-group carpool planning.",
  robots: {
    index: false,
    follow: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
  },
};

// Browser chrome follows the active theme; the manifest can only carry one.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#14121a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <CanonicalLocalOrigin />
        <ServiceWorkerRegistration />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
