import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SASP-INES | Sudanese Students Academic Support Platform",
    template: "%s | SASP-INES",
  },
  description:
    "The official academic support platform for Sudanese students studying at INES-Ruhengeri, Rwanda. Access courses, exams, documents, and announcements.",
  keywords: [
    "INES Ruhengeri",
    "Sudanese students",
    "Rwanda university",
    "academic platform",
    "SASP-INES",
  ],
  authors: [{ name: "SASP-INES" }],
  creator: "SASP-INES",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
