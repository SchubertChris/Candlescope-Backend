import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false,
    });
    console.log("✅ Database connected:", conn.connection.name);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    process.exit(1);
  }
};
