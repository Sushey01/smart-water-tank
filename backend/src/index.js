import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { startBroker } from "./broker.js";
import { connectDb, databaseStatus } from "./db.js";
import { startIngest } from "./ingest.js";
import { asyncHandler, errorHandler } from "./middleware/errorHandler.js";
import { connectMqtt, isMqttConnected } from "./mqtt.js";
import actuatorRoutes from "./routes/actuators.js";
import deviceRoutes from "./routes/devices.js";
import incidentRoutes from "./routes/incidents.js";
import notificationRoutes from "./routes/notifications.js";
import motorRoutes from "./routes/motors.js";
import ruleRoutes from "./routes/rules.js";
import subsystemRoutes from "./routes/subsystems.js";
import tankRoutes from "./routes/tanks.js";
import telemetryRoutes from "./routes/telemetry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const app = express();
app.use(express.json());

app.get(
  "/api/health",
  asyncHandler(async (req, res) => {
    const databases = await databaseStatus();
    const allConnected = Object.values(databases).every((status) => status === "connected");
    res.json({
      mongo: allConnected ? "connected" : "disconnected",
      databases,
      mqtt: isMqttConnected() ? "connected" : "disconnected",
      replicaSet: "rs0",
      telegram: telegramConfigStatus(),
    });
  })
);

app.use("/api/tanks", tankRoutes);
app.use("/api/subsystems", subsystemRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/rules", ruleRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/motors", motorRoutes);
app.use("/api/actuators", actuatorRoutes);
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
