import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "./providers";
import Sidebar from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio AI Agent",
  description: "Advisory AI agent for personal investment portfolio tracking and review.",
};

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
      <body className="min-h-full bg-slate-50/40 text-slate-800 flex flex-col font-sans">
        <Providers>
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Navigation System */}
            <Sidebar />

            {/* Main Workspace */}
            <main className="flex-1 md:pl-16 pb-20 md:pb-0 min-h-screen flex flex-col transition-all duration-300">
              <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
