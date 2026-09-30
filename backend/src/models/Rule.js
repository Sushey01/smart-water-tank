import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    device_type: { type: String, required: true },
    field: { type: String, required: true },
    operator: { type: String, required: true, enum: [">=", ">", "<=", "<", "=="] },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const ruleSchema = new mongoose.Schema(
  {
    rule_id: { type: String, required: true, unique: true },
    home_id: { type: String, required: true },
    subsystem_id: { type: String, required: true },
    tank_id: { type: String },
    name: { type: String, required: true },
    severity: { type: String, required: true },
    kind: { type: String, default: "threshold" },
    conditions: { type: [conditionSchema], default: [] },
    logic: { type: String, default: "AND" },
    action: {
      type: {
        type: String,
        enum: ["none", "motor_off", "lamp_study", "lamp_off", "hvac_on", "hvac_off"],
        default: "none",
      },
      target_device: { type: String },
    },
    escalation: {
      if_unresolved_seconds: { type: Number, default: 30 },
    },
    enabled: { type: Boolean, default: true },
  },
  { versionKey: false, collection: "automation_rules" }
);

export { ruleSchema };
