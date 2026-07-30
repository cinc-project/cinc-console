import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "cinc console",
  description: "Web console for a Cinc Infra Server",
};

/**
 * The nonce-based CSP in proxy.ts only works on dynamically rendered pages: Next
 * takes the nonce from the incoming request, and a page prerendered at build time
 * has no request to take it from — its scripts would ship without a nonce and the
 * browser would refuse to run them. Every real page here is already dynamic (they
 * all read the session cookie); this pins the two that weren't, /login and the 404,
 * and costs nothing — there is nothing user-independent to cache in a console.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
