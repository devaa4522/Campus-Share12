  import type { Metadata, Viewport } from "next";
  import { Noto_Serif, Public_Sans } from "next/font/google";
  import TopNav from "@/components/TopNav";
  import BottomNav from "@/components/BottomNav";
  import MessageFAB from "@/components/MessageFAB";
  import OfflineBanner from "@/components/OfflineBanner";
  import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
  import MainWrapper from "@/components/MainWrapper";
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
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
      ]
    },
  };

  export const viewport: Viewport = {
    themeColor: "#0f1c30",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };

  import { Toaster } from 'react-hot-toast';
  import { NotificationToastContainer } from '@/components/NotificationToast';

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
        data-scroll-behavior="smooth"
      >
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
          {/* Add this to help the browser find the manifest faster */}
        </head>
        {/* REMOVED overflow-hidden and ADDED overflow-x-hidden */}
        <body className="flex flex-col min-h-[100dvh] overflow-x-hidden bg-surface text-on-surface font-body">
          <ServiceWorkerRegister />
          <OfflineBanner />
          <Toaster position="top-center" />
          <NotificationToastContainer />
          
          <TopNav />
          
          {/* MainWrapper should be the one handling the growth and scroll */}
          <MainWrapper>
            {children}
          </MainWrapper>
          
          {/* <MessageFAB /> */}
          <BottomNav />
        </body>
      </html>
    );
  }
