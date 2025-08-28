import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ENV } from "../../utils/env";
import { findOrCreateOAuthUser } from "../../services/oauth/userService.js";

export default function googleStrategy(passport) {
  if (!ENV.GOOGLE.CLIENT_ID || !ENV.GOOGLE.CLIENT_SECRET) {
    console.log("GOOGLE OAUTH DISABLED - Missing credentials");
    return;
  }

  const callbackURL = `${
    ENV.NODE_ENV === "production" ? ENV.BACKEND_URL : "http://localhost:5000"
  }/api/oauth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: ENV.GOOGLE.CLIENT_ID,
        clientSecret: ENV.GOOGLE.CLIENT_SECRET,
        callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser("google", profile);
          done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}
