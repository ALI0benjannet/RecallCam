// Only the Next.js server resolves this address. It is never sent to the browser.
const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/health/live", destination: `${backendUrl}/health/live` },
    ];
  },
};

export default config;
