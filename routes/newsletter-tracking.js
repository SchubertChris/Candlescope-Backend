export const applyNewsletterTracking = (app) => {
  app.get("/api/newsletter/track/open/:subscriberId/:newsletterId", async (req, res) => {
    try {
      const { subscriberId, newsletterId } = req.params;
      const { default: newsletterService } = await import("../services/newsletter-service.js");
      await newsletterService.trackEmailOpen(subscriberId, newsletterId);
      const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ...", "base64");
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": pixel.length });
      res.end(pixel);
    } catch {
      res.end();
    }
  });

  app.get("/api/newsletter/track/click/:subscriberId/:newsletterId", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });
    res.redirect(decodeURIComponent(url));
  });
};
