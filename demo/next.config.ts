import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@depositoor/react"],
  turbopack: {},
};

export default nextConfig;
