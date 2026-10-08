import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/subscribe", "/api"],
    },
    sitemap: "https://notes.eduvorea.com/sitemap.xml",
    host: "https://notes.eduvorea.com",
  };
}