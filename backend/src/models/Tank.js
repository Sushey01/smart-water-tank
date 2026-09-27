import mongoose from "mongoose";

const tankSchema = new mongoose.Schema(
  {
    tank_id: { type: String, required: true, unique: true },
    home_id: { type: String, required: true },
    name: { type: String, default: "Roof Tank" },
    capacity_litres: { type: Number, required: true },
    motor_device_id: { type: String, required: true },
    location: { type: String, default: "Roof" },
    thresholds: {
      warning_pct: { type: Number, default: 90 },
      overflow_pct: { type: Number, default: 98 },
    },
  },
  { versionKey: false, collection: "tanks" }
);

export const Tank = mongoose.model("Tank", tankSchema);
