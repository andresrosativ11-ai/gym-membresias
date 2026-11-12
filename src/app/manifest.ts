import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym · Membresías",
    short_name: "Gym",
    start_url: "/checkin",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#18181b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
