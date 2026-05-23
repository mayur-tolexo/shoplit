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
};
export default nextConfig;
