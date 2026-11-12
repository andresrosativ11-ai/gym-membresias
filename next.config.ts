import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las fotos se redimensionan en el cliente, pero dejamos margen.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
