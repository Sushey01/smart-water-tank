import mongoose from "mongoose";
import { DEVICE_TYPES } from "../constants.js";

const deviceLatestSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true, unique: true },
    home_id: { type: String, required: true },
    subsystem_id: { type: String, required: true },
    tank_id: { type: String },
    device_type: { type: String, required: true, enum: DEVICE_TYPES },
    timestamp: { type: Date, required: true },
    reading: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { versionKey: false, collection: "device_latest" }
);

export { deviceLatestSchema };
