import mongoose from "mongoose";
import { DEVICE_TYPES } from "../constants.js";

const deviceSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true, unique: true },
    device_type: { type: String, required: true, enum: DEVICE_TYPES },
    tank_id: { type: String, required: true },
    home_id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { versionKey: false, collection: "devices" }
);

export const Device = mongoose.model("Device", deviceSchema);
