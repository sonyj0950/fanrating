import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/account", "/me/", "/login"],
    },
    sitemap: "https://fanarena.kr/sitemap.xml",
    host: "https://fanarena.kr",
  };
}
