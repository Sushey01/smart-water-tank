import mongoose from "mongoose";

export async function connectDb() {
  const uri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/smart_water?replicaSet=rs0";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    readPreference: "primary",
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose.connection;
}
