import type { NextConfig } from "next";

/**
 * Response headers that hold for every route. The per-request CSP (with its
 * nonce) is set in proxy.ts, which only runs on page routes — so the API routes
 * get their own trivial CSP here: they return JSON, and `default-src 'none'`
 * plus `frame-ancestors 'none'` means a JSON body can never be replayed as a
 * document with privileges.
 *
 * `Strict-Transport-Security` is ignored by browsers on plain-HTTP responses, so
 * it is safe to send unconditionally — it only takes effect once the console is
 * actually served over TLS, which is the deployment the Helm chart assumes.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Belt-and-braces with the CSP's frame-ancestors, for anything that predates it.
  { key: "X-Frame-Options", value: "DENY" },
  // Object names and org slugs live in the URL; never leak them to another site.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
