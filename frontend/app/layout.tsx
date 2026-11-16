import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "comGpt — The omnichannel growth operating system",
    template: "%s · comGpt"
  },
  description:
    "comGpt unifies email, WhatsApp and SMS campaigns, visual automation, a shared inbox and revenue analytics in one colorful workspace.",
  applicationName: "comGpt",
  authors: [{ name: "comGpt" }],
  keywords: ["omnichannel marketing", "email marketing", "WhatsApp", "SMS", "automation", "CRM"],
  openGraph: {
    title: "comGpt — The omnichannel growth operating system",
    description: "Campaigns, automation, inbox, and analytics for modern growth teams.",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0819" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
