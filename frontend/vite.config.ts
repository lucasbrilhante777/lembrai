import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // O front sempre chama "/api/...". Em desenvolvimento, o Vite repassa para a API local;
    // em produção, a Vercel faz o mesmo papel. Assim front e API ficam na MESMA origem e o
    // cookie de login (SameSite=Lax) funciona sem configurar CORS para outro domínio.
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
