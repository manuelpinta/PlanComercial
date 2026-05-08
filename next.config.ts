import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que el bundler meta mysql2 en el chunk del server; en Vercel suele evitar fallos de build o runtime.
  serverExternalPackages: ["mysql2"],
  // Workaround: errores "SegmentViewNode" / React Client Manifest en `next dev` (Next 15 devtools).
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
