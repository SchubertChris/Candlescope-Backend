export const applyDebugRoutes = (app) => {
  if (process.env.NODE_ENV !== "development") return;

  app.get("/debug/env", (req, res) => {
    res.json({
      node_env: process.env.NODE_ENV,
      has_mongodb: !!process.env.MONGODB_URI,
      admin_email: process.env.ADMIN_EMAIL,
    });
  });

  app.get("/debug/headers", (req, res) => {
    res.json({ headers: req.headers });
  });

  app.get("/debug/cors-test", (req, res) => {
    res.json({
      message: "CORS test successful",
      origin: req.get("Origin"),
    });
  });
};
