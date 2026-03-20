import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles only what's needed to run `node server.js`.
  // Required for the single-container Docker image (Dockerfile).
  output: "standalone",

  // Proxy /api/* to the FastAPI backend running on :8000 inside the container.
  // This lets NEXT_PUBLIC_API_URL=/api work at any public hostname without
  // baking the App Runner URL into the browser bundle at build time.
  async rewrites() {
    const apiBase =
      process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
