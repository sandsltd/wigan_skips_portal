import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getBusinessConfig } from "@/lib/supabase";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getBusinessConfig();
  return {
    title: `${config.businessName} Portal`,
    description: "Access your waste management documents and account information",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: config.businessName,
    },
    formatDetection: {
      telephone: true,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const config = await getBusinessConfig();
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: config.primaryColor,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
