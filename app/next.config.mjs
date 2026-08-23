/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // config/mainnet.json lives outside app/, so allow importing across the root.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
