import mongoose from "mongoose";
import { DEVICE_TYPES } from "../constants.js";

const deviceSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true, unique: true },
    device_type: { type: String, required: true, enum: DEVICE_TYPES },
    subsystem_id: { type: String, required: true },
    tank_id: { type: String },
    home_id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { versionKey: false, collection: "devices" }
);

export { deviceSchema };
