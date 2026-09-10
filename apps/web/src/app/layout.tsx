import type { Metadata } from "next";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";
import AccessibilityProvider from "@/components/AccessibilityProvider";

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
    <html lang="en">
      <body>
        <LanguageProvider>
          <AccessibilityProvider>
            {children}
          </AccessibilityProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
