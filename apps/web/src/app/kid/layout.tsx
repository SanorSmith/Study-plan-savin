import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

// The kid page is its own installable app: its own name, icon and start page.
export const metadata: Metadata = {
  title: "Study Plan Kid",
  applicationName: "Study Plan Kid",
  manifest: "/kid/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Study Plan", statusBarStyle: "default" },
  icons: { icon: "/icons/kid-icon-192.png", apple: "/icons/kid-apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#F59E0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function KidLayout({ children }: { children: ReactNode }) {
  return children;
}
