import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // `vercel dev` serves the API on 3000 during local development
      "/api": "http://localhost:3000",
    },
  },
});
