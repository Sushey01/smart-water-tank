import mongoose from "mongoose";

const subsystemSchema = new mongoose.Schema(
  {
    subsystem_id: { type: String, required: true, unique: true },
    home_id: { type: String, required: true },
    type: { type: String, required: true, enum: ["water_tank", "focus_room", "climate"] },
    name: { type: String, required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, collection: "subsystems" }
);

export { subsystemSchema };
