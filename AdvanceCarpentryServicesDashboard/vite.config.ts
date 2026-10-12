import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_TARGET = process.env.API_TARGET ?? "http://localhost:3001";

export default defineConfig({
    plugins: [react(),         tailwindcss(),],

    server: {
        allowedHosts: ['.trycloudflare.com'],
        watch: {
            ignored: [
                "**/db.json",
                "**/uploads/**",
            ],
        },

        proxy: {
            "/api": {
                target: API_TARGET,
                changeOrigin: true,
            },

            "/uploads": {
                target: API_TARGET,
                changeOrigin: true,
            },
        },
    },
});