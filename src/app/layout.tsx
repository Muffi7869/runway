import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDocument } from "../components/root-document";
import { THEME_COOKIE_NAME } from "../lib/theme";
import { siteUrl } from "../lib/site-url";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(siteUrl())
    : undefined,
  title: "Runway",
  description: "A personal assignment planning app.",
  openGraph: {
    title: "Runway",
    description: "A personal assignment planning app.",
    url: "/",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const themePreference = cookieStore.get(THEME_COOKIE_NAME)?.value;

  return (
    <RootDocument
      fontClassName={plusJakartaSans.variable}
      themePreference={themePreference}
    >
      {children}
    </RootDocument>
  );
}
