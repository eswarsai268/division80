import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({ plugins: [tailwindcss(), react()], server: { port: 5173, proxy: { "/api": process.env.VITE_API_PROXY ?? "http://localhost:4000" } } });
