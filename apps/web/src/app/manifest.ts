import type { MetadataRoute } from "next";

/** Lets a parent add the website to the home screen and open it full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Study Plan",
    short_name: "Study Plan",
    description: "Homework first, screen time after. Parent app.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#6C4CF1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Dashboard", url: "/dashboard" }],
  };
}
