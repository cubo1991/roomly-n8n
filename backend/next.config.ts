import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // needed for Docker multi-stage build
};

export default nextConfig;
