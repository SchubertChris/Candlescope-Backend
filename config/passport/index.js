import passport from "passport";
import googleStrategy from "./googleStrategy.js";
import githubStrategy from "./githubStrategy.js";
import { serialize, deserialize } from "./serialize.js";

googleStrategy(passport);
githubStrategy(passport);

passport.serializeUser(serialize);
passport.deserializeUser(deserialize);

export default passport;
