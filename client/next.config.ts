/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["res.cloudinary.com", "localhost"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          "https://image-metadata-generator-server.vercel.app/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
