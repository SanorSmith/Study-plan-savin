/** Lets a kid add the kid page to the home screen as its own app (separate from the parent app). */
export function GET() {
  return Response.json(
    {
      name: "Study Plan Kid",
      short_name: "Study Plan",
      description: "Homework first, screen time after.",
      id: "/kid",
      start_url: "/kid",
      scope: "/kid",
      display: "standalone",
      orientation: "portrait",
      background_color: "#FFF3D6",
      theme_color: "#F59E0B",
      icons: [
        { src: "/icons/kid-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/kid-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/kid-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
}
