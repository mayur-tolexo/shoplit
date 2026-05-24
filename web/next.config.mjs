/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image stays small and doesn't need the full node_modules tree.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "assets.myntassets.com" },
      { protocol: "https", hostname: "images-static.nykaa.com" },
      { protocol: "https", hostname: "rukminim2.flixcart.com" },
    ],
  },
  async rewrites() {
    // The app talks to the backend directly via NEXT_PUBLIC_API_BASE_URL
    // (CORS-enabled), so /api no longer needs a proxy. We keep /go and /p
    // rewrites so public cart-page product links resolve to the redirect
    // service through the same origin.
    return [
      { source: "/go/:path*", destination: "http://localhost:8081/go/:path*" },
      { source: "/p/:path*", destination: "http://localhost:8081/p/:path*" },
    ];
  },
};
export default nextConfig;
