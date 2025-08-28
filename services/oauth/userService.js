import User from "../../models/user/user.js";
import emailService from "../email-service.js";

export async function findOrCreateOAuthUser(provider, profile) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error(`No email found for ${provider} user`);

  let user = await User.findOne({ email });
  let isNewUser = false;

  if (user) {
    user.lastLogin = new Date();
    if (!user[`${provider}Id`]) {
      user[`${provider}Id`] = profile.id;
    }
    await user.save();
    return user;
  }

  // Neuer User
  user = new User({
    email,
    password: "oauth_user",
    [`${provider}Id`]: profile.id,
    name: profile.displayName || profile.username,
    avatar: profile.photos?.[0]?.value,
    isEmailVerified: true,
    role: "kunde",
    authProvider: provider,
    createdAt: new Date(),
    lastLogin: new Date(),
  });
  await user.save();
  isNewUser = true;

  if (isNewUser) {
    await emailService?.sendOAuthWelcomeEmail?.(user.email, provider, user.name);
  }

  return user;
}
