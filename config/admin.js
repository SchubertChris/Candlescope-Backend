export const ensureAdminAccount = async () => {
  const { default: User } = await import("../models/user/User.js");
  const { default: bcrypt } = await import("bcrypt");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("⚠️ ADMIN_EMAIL or ADMIN_PASSWORD not set");
    return;
  }

  let admin = await User.findOne({ email });
  if (!admin) {
    console.log("🆕 Creating admin account...");
    admin = new User({
      email,
      password: await bcrypt.hash(password, 10),
      role: "admin",
      isEmailVerified: true,
    });
    await admin.save();
    console.log("✅ Admin created:", email);
  } else {
    console.log("✅ Admin exists:", email);
  }
};
