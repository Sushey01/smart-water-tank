import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    incident_id: { type: String, required: true, unique: true },
    home_id: { type: String, required: true },
    subsystem_id: { type: String },
    tank_id: { type: String },
    rule_id: { type: String },
    severity: { type: String, required: true },
    origin_severity: { type: String },
    triggered_at: { type: Date, required: true },
    resolved_at: { type: Date },
    acknowledged_at: { type: Date },
    triggered_by: { type: [mongoose.Schema.Types.Mixed], default: [] },
    action_taken: {
      type: { type: String, default: "none" },
      target_device: { type: String },
      status: { type: String, default: "none" },
    },
    escalated: { type: Boolean, default: false },
    open: { type: Boolean, default: true },
    litres_saved: { type: Number, default: 0 },
    assumed_unattended_minutes: { type: Number, default: 0 },
    flow_rate_lpm_at_trigger: { type: Number, default: 0 },
  },
  { versionKey: false, collection: "incidents" }
);

export { incidentSchema };
