import type { Metadata } from "next";
import { Sora, Manrope } from "next/font/google";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";
import AccessibilityProvider from "@/components/AccessibilityProvider";
import JeevaOrbGate from "@/components/JeevaOrbGate";

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JeevanLink",
  description: "Your Health. Your Continuity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${manrope.variable}`}>
      <body>
        <LanguageProvider>
          <AccessibilityProvider>
            {children}
            <JeevaOrbGate />
          </AccessibilityProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
