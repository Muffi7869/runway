import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { RootDocument } from "../components/root-document";
import { THEME_COOKIE_NAME } from "../lib/theme";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "500", "600", "700"],
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
      fontClassName={plusJakartaSans.variable}
      themePreference={themePreference}
    >
      {children}
    </RootDocument>
  );
}
