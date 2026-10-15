import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDocument } from "../components/root-document";
import { THEME_COOKIE_NAME } from "../lib/theme";
import "./globals.css";

const geistSans = Geist({
  display: "swap",
  variable: "--font-geist-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  display: "swap",
  variable: "--font-geist-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Runway",
  description: "A personal assignment planning app.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const themePreference = cookieStore.get(THEME_COOKIE_NAME)?.value;

  return (
    <RootDocument
      fontClassName={`${geistSans.variable} ${geistMono.variable}`}
      themePreference={themePreference}
    >
      {children}
    </RootDocument>
  );
}
