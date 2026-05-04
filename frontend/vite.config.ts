import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // true: bind IPv4 + IPv6 so `localhost` and `127.0.0.1` hit this app (avoids a second stray listener on [::1] only).
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: "http://127.0.0.1:8020", changeOrigin: true, ws: true },
    },
  },
});
