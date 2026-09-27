import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    notification_id: { type: String, required: true, unique: true },
    incident_id: { type: String, required: true },
    home_id: { type: String, required: true },
    tank_id: { type: String, required: true },
    severity: { type: String, required: true },
    message: { type: String, required: true },
    channel: { type: String, required: true },
    delivered: { type: Boolean, default: false },
    error: { type: String, default: "" },
    created_at: { type: Date, required: true },
  },
  { versionKey: false, collection: "notifications" }
);

export const Notification = mongoose.model("Notification", notificationSchema);
