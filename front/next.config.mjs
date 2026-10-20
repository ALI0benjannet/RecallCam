// Only the Next.js server resolves this address. It is never sent to the browser.
const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const config = {
  // Video bodies stream through rewrites; leave the backend enough time to store the file.
  experimental: {
    proxyTimeout: Number(process.env.BACKEND_PROXY_TIMEOUT_SECONDS ?? "3600") * 1000,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/health/live", destination: `${backendUrl}/health/live` },
    ];
  },
};

export default config;
