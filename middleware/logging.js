export const applyRequestLogging = (app) => {
  if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`\n${timestamp} - ${req.method} ${req.path}`);
      console.log("🔍 Origin:", req.get("Origin"));
      console.log("🔍 Content-Type:", req.get("Content-Type"));
      console.log("🔍 User-Agent:", req.get("User-Agent"));
      if (req.body && Object.keys(req.body).length > 0) {
        console.log("📊 Body:", req.body);
      }
      next();
    });
  }
};
