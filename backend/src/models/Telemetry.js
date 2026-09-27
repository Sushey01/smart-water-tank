import mongoose from "mongoose";
import { DEVICE_TYPES } from "../constants.js";

const telemetrySchema = new mongoose.Schema(
  {
    home_id: { type: String, required: true },
    tank_id: { type: String, required: true },
    device_id: { type: String, required: true },
    device_type: { type: String, required: true, enum: DEVICE_TYPES },
    timestamp: { type: Date, required: true },
    reading: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { versionKey: false, collection: "telemetry" }
);

export const Telemetry = mongoose.model("Telemetry", telemetrySchema);
