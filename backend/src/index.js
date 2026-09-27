import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { startBroker } from "./broker.js";
import { connectDb } from "./db.js";
import { startIngest } from "./ingest.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { connectMqtt, isMqttConnected } from "./mqtt.js";
import deviceRoutes from "./routes/devices.js";
import incidentRoutes from "./routes/incidents.js";
import notificationRoutes from "./routes/notifications.js";
import motorRoutes from "./routes/motors.js";
import ruleRoutes from "./routes/rules.js";
import tankRoutes from "./routes/tanks.js";
import telemetryRoutes from "./routes/telemetry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    mqtt: isMqttConnected() ? "connected" : "disconnected",
    replicaSet: "rs0",
    telegram: telegramConfigStatus(),
  });
});

app.use("/api/tanks", tankRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/motors", motorRoutes);
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "public")));
app.use(errorHandler);

function telegramConfigStatus() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return "not_configured";
  if (!token.includes(":")) return "token_incomplete";
  return "configured";
}

const port = Number(process.env.PORT) || 3000;

await connectDb();
await startBroker();
const mqtt = connectMqtt();
startIngest(mqtt);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
