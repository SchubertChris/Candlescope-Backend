import User from "../../models/user/user";

export function serialize(user, done) {
  console.log("🔐 SERIALIZING USER:", user._id);
  done(null, user._id);
}

export async function deserialize(id, done) {
  try {
    console.log("🔓 DESERIALIZING USER:", id);
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
}
