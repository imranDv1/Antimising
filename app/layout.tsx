import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://notes.eduvorea.com"),
  title: {
    default: "Rinsign",
    template: "%s | Rinsign",
  },
  description:
    "Notes, canvas, and passwords — all in one secure workspace. Capture ideas, sketch on an infinite canvas, manage passwords, and let AI help you write.",
  applicationName: "Rinsign",
  keywords: [
    "notes app",
    "note taking",
    "AI notes",
    "password manager",
    "infinite canvas",
    "whiteboard",
    "excalidraw",
    "online notes",
    "secure notes",
    "Rinsign",
  ],
  authors: [{ name: "Imran Ahmed", url: "https://github.com/imranDv1" }],
  creator: "Imran Ahmed",
  publisher: "Imran Ahmed",
  category: "productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://notes.eduvorea.com",
    siteName: "Rinsign",
    title: "Rinsign",
    description:
      "Notes, canvas, and passwords — all in one secure workspace with an AI writing assistant.",
    images: [
      {
        url: "/Images/Rinsign.jpg",
        alt: "Rinsign — notes, canvas, and passwords",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rinsign",
    description:
      "Notes, canvas, and passwords — all in one secure workspace with an AI writing assistant.",
    images: ["/Images/Rinsign.jpg"],
    creator: "@imrandv1",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icons/logo.svg",
    shortcut: "/icons/logo.svg",
    apple: "/icons/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
