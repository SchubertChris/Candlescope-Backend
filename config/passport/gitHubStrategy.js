import { Strategy as GitHubStrategy } from "passport-github2";
import { ENV } from "../../utils/env.js";
import { findOrCreateOAuthUser } from "../../services/oauth/userService.js";

export default function githubStrategy(passport) {
  if (!ENV.GITHUB.CLIENT_ID || !ENV.GITHUB.CLIENT_SECRET) {
    console.log("⚠️ GITHUB OAUTH DISABLED - Missing credentials");
    return;
  }

  const callbackURL = `${
    ENV.NODE_ENV === "production" ? ENV.BACKEND_URL : "http://localhost:5000"
  }/api/oauth/github/callback`;
  console.log("🔗 GITHUB CALLBACK URL:", callbackURL);

  passport.use(
    new GitHubStrategy(
      {
        clientID: ENV.GITHUB.CLIENT_ID,
        clientSecret: ENV.GITHUB.CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser("github", profile);
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}
