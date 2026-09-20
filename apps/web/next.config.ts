import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(
      __dirname
    ),
  },

  // No CSP here yet -- getting one right needs testing against every
  // page's actual script/style/font sources first, skip until that's
  // done rather than ship one that's guessed. The rest below are safe
  // defaults with no such risk.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No legitimate reason for JeevanLink to be framed by
          // another site -- a login-gated health app framed
          // elsewhere is a clickjacking setup, not a real use case.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Jeeva's mic capture happens in this same top-level page,
          // never a cross-origin iframe, so (self) covers it; every
          // other sensitive permission is denied outright.
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;