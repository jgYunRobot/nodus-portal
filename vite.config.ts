import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  const pilot_proxy_target = environment.VITE_PILOT_PROXY_TARGET;

  return {
    plugins: [react()],
    server:
      pilot_proxy_target === undefined || pilot_proxy_target.length === 0
        ? undefined
        : {
            proxy: {
              "/api": {
                target: pilot_proxy_target,
                changeOrigin: true
              }
            }
          },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"]
    }
  };
});
