import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy.
//
// `script-src` still needs 'unsafe-inline': Next injects its hydration
// bootstrap inline and the app is not using nonce-based CSP. Everything that
// actually matters against injection is locked down here — object/base-uri,
// framing, form targets, and the origins scripts and connections may reach.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    isDev ? " 'unsafe-eval'" : ""
  } https://challenges.cloudflare.com https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://challenges.cloudflare.com https://va.vercel-scripts.com https://vitals.vercel-insights.com${
    isDev ? " ws: http://localhost:3000" : ""
  }`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://pay.sifalo.com",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    // The editor records audio and Excalidraw may use the camera, so those are
    // allowed for this origin only. Everything else is denied outright.
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  // HSTS would pin https://localhost in development, so only send it in prod.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      // pica throws ERR_GET_IMAGE_DATA under browser fingerprinting
      // protection (Brave shields, Firefox RFP), which breaks image insertion
      // in Excalidraw. The shim swaps getImageData for drawImage/toBlob.
      pica: "./lib/pica-shim.js",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/u/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      // Add Cloudinary
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**", // allow all paths
      },
    ],
  },
};

export default nextConfig;
