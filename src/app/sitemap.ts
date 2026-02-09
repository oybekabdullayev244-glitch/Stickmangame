import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stickmangame-amber.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/play", "/about", "/updates", "/privacy", "/terms"];
  const now = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/play" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/play" ? 0.9 : 0.6,
  }));
}
