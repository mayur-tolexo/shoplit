/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "assets.myntassets.com" },
      { protocol: "https", hostname: "images-static.nykaa.com" },
      { protocol: "https", hostname: "rukminim2.flixcart.com" },
    ],
  },
  async rewrites() {
    // Same-origin proxy to the Go API and redirect service so the frontend
    // uses simple relative paths and the browser sends cookies automatically
    // (no CORS).
    return [
      { source: "/api/:path*", destination: "http://localhost:8080/api/:path*" },
      { source: "/go/:path*", destination: "http://localhost:8081/go/:path*" },
      { source: "/p/:path*", destination: "http://localhost:8081/p/:path*" },
    ];
  },
};
export default nextConfig;
