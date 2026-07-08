import type { NextConfig } from "next";

const isTauriBuild = process.env.TAURI_BUILD === "1";

const nodeProxyTarget =
  process.env.NODE_API_BASE_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:7878";

const nextConfig: NextConfig = {
  ...(isTauriBuild
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true }
      }
    : {}),
  async rewrites() {
    if (isTauriBuild) {
      return [];
    }
    return [
      {
        source: "/api/node/:path*",
        destination: `${nodeProxyTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
