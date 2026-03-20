// server/index.ts — COMPLETE FIXED VERSION
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";

const app = express();

/* ===============================
   Trust proxy (ALB / API Gateway)
================================ */
app.set("trust proxy", true);

/* ===============================
   Body parsing
================================ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Request logging
================================ */
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: unknown;

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    capturedJsonResponse = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (!pathReq.startsWith("/api")) return;

    const duration = Date.now() - start;
    let logLine = `${req.method} ${pathReq} ${res.statusCode} ${duration}ms`;

    if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 200) {
      logLine = logLine.slice(0, 199) + "…";
    }

    console.log(logLine);
  });

  next();
});

/* ===============================
   Health check
================================ */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    runtime: process.env.AWS_LAMBDA_FUNCTION_NAME ? "lambda" : "server",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   Initialization Function
================================ */
export async function setupApp() {
  // Load dotenv for local development
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const dotenv = await import("dotenv");
      dotenv.config();
    } catch (e) {
      // ignore
    }
  }

  // Manual migration for production (Ensures STANDARD_9MM exists)
  try {
    const { runMigrations } = await import("./migrate");
    await runMigrations();
  } catch (err) {
    console.error("Migration import error:", err);
  }

  // Authentication
  const { setupAuth } = await import("./auth");
  setupAuth(app);

  // Routes
  const httpServer = await registerRoutes(app);

  /* ===============================
     Error handler
  ================================ */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("🔥 Unhandled error:", err);

    const status = err.statusCode || err.status || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message || "Internal Server Error";

    res.status(status).json({ message });
  });

  return { app, httpServer };
}

/* ===============================
   Standalone server only
================================ */
const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

if (!isLambda) {
  // Using .then instead of top-level await to satisfy esbuild CJS limitation
  setupApp().then(async ({ app: initializedApp, httpServer }) => {
    const PORT = Number(process.env.PORT || 5000);

    if (process.env.NODE_ENV === "production") {
      const clientPath = path.join(process.cwd(), "dist", "client");
      initializedApp.use(express.static(clientPath));

      initializedApp.get("/{*path}", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(clientPath, "index.html"));
      });
    } else {
      // In development, setup Vite middleware AFTER routes
      const { setupVite } = await import("./vite");
      await setupVite(initializedApp, httpServer);
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error("❌ Failed to initialize app:", err);
  });
}

export { app };