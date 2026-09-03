import path from "path"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import Icons from "unplugin-icons/vite"

function appRoutingPlugin(): Plugin {
  const rewrite = (req: any, _res: any, next: () => void) => {
    const rawUrl = req.url || "/"
    const pathname = rawUrl.split("?")[0]
    // If request is not root, has no file extension, and is not a Vite internal route, route to app.html
    if (
      pathname !== "/" &&
      !pathname.includes(".") &&
      !pathname.startsWith("/@") &&
      !pathname.startsWith("/__") &&
      !pathname.startsWith("/src") &&
      !pathname.startsWith("/node_modules")
    ) {
      const search = rawUrl.includes("?") ? "?" + rawUrl.split("?").slice(1).join("?") : ""
      req.url = "/app.html" + search
    }
    next()
  }

  return {
    name: "app-routing-middleware",
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Icons({ compiler: "jsx", jsx: "react" }),
    appRoutingPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app.html"),
      },
    },
  },
})
