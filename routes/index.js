import authRouter from "./auth.js";
import dashboardRouter from "./dashboard.js";
import oauthRouter from "./oauth.js";
import contactRouter from "./contact.js";
import newsletterRouter from "./newsletter.js";

import Router from "express";

const router = Router();

router.use("/auth", authRouter);
router.use("/oauth", oauthRouter);
router.use("/contact", contactRouter);
router.use("/dashboard", dashboardRouter);
router.use("/newsletter", newsletterRouter);

export default router;
