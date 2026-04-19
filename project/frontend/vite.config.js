import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  
  // ✅ Production base path
  base: "/", 
  
  server: {
    port: 5173,
    host: true,
    cors: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",  // Dev
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: process.env.PORT || 4173,
    host: true,
  },

  build: {
    outDir: "dist",
  },
});
