import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SASP-INES | Smart Academic Support Platform",
    template: "%s | SASP-INES",
  },
  description:
    "The official academic support platform for students at INES-Ruhengeri, Rwanda. Access courses, exams, documents, and announcements.",
  keywords: [
    "INES Ruhengeri",
    "Smart Academic Support Platform",
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
      <head>
        {/* Blocking script: applies the saved theme BEFORE first paint,
            so there's no flash of the wrong theme on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var isDark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
