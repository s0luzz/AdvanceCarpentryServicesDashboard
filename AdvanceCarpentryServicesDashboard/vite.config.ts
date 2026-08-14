import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(),         tailwindcss(),],

    server: {
        watch: {
            ignored: [
                "**/db.json",
                "**/uploads/**",
            ],
        },

        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },

            "/uploads": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
});