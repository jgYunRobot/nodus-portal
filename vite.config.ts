import { createLogger, defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  const pilot_proxy_target = environment.VITE_PILOT_PROXY_TARGET;
  const logger = createLogger();
  const log_error = logger.error.bind(logger);
  const unavailable_log_interval_ms = 30_000;
  let pilot_unavailable = false;
  let last_unavailable_log_ms = 0;

  logger.error = (message, options) => {
    const error = options?.error as NodeJS.ErrnoException | undefined;
    if (
      pilot_proxy_target &&
      message.includes("http proxy error: /api/") &&
      error?.code === "ECONNREFUSED"
    ) {
      const now_ms = Date.now();
      if (
        !pilot_unavailable ||
        now_ms - last_unavailable_log_ms >= unavailable_log_interval_ms
      ) {
        logger.warn(
          `Pilot unavailable (${pilot_proxy_target}); Portal is retrying connections.`,
          { timestamp: true }
        );
        last_unavailable_log_ms = now_ms;
      }
      pilot_unavailable = true;
      return;
    }
    log_error(message, options);
  };

  return {
    customLogger: logger,
    plugins: [react()],
    server:
      pilot_proxy_target === undefined || pilot_proxy_target.length === 0
        ? undefined
        : {
            proxy: {
              "/api": {
                target: pilot_proxy_target,
                changeOrigin: true,
                configure: (proxy) => {
                  proxy.on("proxyRes", () => {
                    if (!pilot_unavailable) return;
                    pilot_unavailable = false;
                    logger.info(`Pilot connected (${pilot_proxy_target}).`, {
                      timestamp: true
                    });
                  });
                }
              }
            }
          },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"]
    }
  };
});
