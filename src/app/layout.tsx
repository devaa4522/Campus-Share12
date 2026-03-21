import type { Metadata, Viewport } from "next";
import { Noto_Serif, Public_Sans } from "next/font/google";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import MessageFAB from "@/components/MessageFAB";
import "./globals.css";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-headline",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Campus Share",
    template: "%s | Campus Share",
  },
  description:
    "Exchange academic resources, campus errands, and student favors within your college network.",
  manifest: "/manifest.json",
  icons: { icon: "/icons8-university-100.png", apple: "/icons8-university-100.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f1c30",
  width: "device-width",
  initialScale: 1,
};

import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${notoSerif.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface font-body">
        <Toaster position="top-center" />
        <TopNav />
        <main className="pt-24 min-h-screen pb-24 md:pb-8">{children}</main>
        <MessageFAB />
        <BottomNav />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
