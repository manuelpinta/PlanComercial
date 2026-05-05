import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que el bundler meta mysql2 en el chunk del server; en Vercel suele evitar fallos de build o runtime.
  serverExternalPackages: ["mysql2"],
};

export default nextConfig;
