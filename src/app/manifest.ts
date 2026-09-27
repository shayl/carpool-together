import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carpool Together",
    short_name: "Carpool",
    description: "Coordinate private group carpools.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7fc",
    theme_color: "#e75f3f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
