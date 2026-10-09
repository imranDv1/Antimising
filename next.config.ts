import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // pica throws ERR_GET_IMAGE_DATA under browser fingerprinting
      // protection (Brave shields, Firefox RFP), which breaks image insertion
      // in Excalidraw. The shim swaps getImageData for drawImage/toBlob.
      pica: "./lib/pica-shim.js",
    },
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
