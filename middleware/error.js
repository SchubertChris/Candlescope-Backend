export const applyErrorHandling = (app) => {
  app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found", path: req.originalUrl });
  });

  app.use((err, req, res, next) => {
    console.error("❌ Global error:", err.message);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
    });
  });
};
