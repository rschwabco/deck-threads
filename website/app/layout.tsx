import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "deck-threads.cognitive-dynamics.io";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const title = "Deck Threads — Agent tasks on Stream Deck";
  const description = "A local macOS companion that turns Stream Deck into a live control surface for your desktop coding agent.";

  return {
    metadataBase: baseUrl,
    title,
    description,
    icons: { icon: "/deck-threads-icon.png", apple: "/deck-threads-icon.png" },
    openGraph: { title, description, type: "website", url: baseUrl, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Deck Threads — Your agent tasks, at a glance." }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
