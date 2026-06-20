import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        acceptWitness: resolve(__dirname, "accept-witness/index.html"),
      },
    },
  },
});
