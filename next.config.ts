import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikacja jest w całości dynamiczna (sesja Supabase w ciasteczkach),
  // więc Cache Components zostawiamy wyłączone.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
