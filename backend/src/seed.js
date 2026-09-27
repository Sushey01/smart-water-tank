import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDb } from "./db.js";
import { Device, DeviceLatest, Incident, Rule, Tank, Telemetry } from "./models/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const HOME = "home_001";
const TANK = "tank_roof_01";
const MOTOR = "motor_roof_01";

const devices = [
  { device_id: "tank_level_roof_01", device_type: "tank_level", name: "Roof tank level" },
  { device_id: "water_flow_roof_01", device_type: "water_flow", name: "Roof tank flow" },
  { device_id: MOTOR, device_type: "motor_state", name: "Roof tank pump" },
  { device_id: "source_roof_01", device_type: "source_presence", name: "Pump inlet water" },
];

const rules = [
  {
    rule_id: "rule_warning_roof",
    name: "Warn at 90 percent",
    severity: "warning",
    kind: "threshold",
    conditions: [
      { device_type: "tank_level", field: "level_pct", operator: ">=", value: 90 },
      { device_type: "motor_state", field: "state", operator: "==", value: "on" },
    ],
    action: { type: "none" },
  },
  {
    rule_id: "rule_overflow_roof",
    name: "Stop pump before overflow",
    severity: "overflow_prevented",
    kind: "threshold",
    conditions: [
      { device_type: "tank_level", field: "level_pct", operator: ">=", value: 98 },
      { device_type: "motor_state", field: "state", operator: "==", value: "on" },
    ],
    action: { type: "motor_off", target_device: MOTOR },
  },
  {
    rule_id: "rule_dry_run_roof",
    name: "Stop pump when inlet is dry",
    severity: "dry_run",
    kind: "threshold",
    conditions: [
      { device_type: "motor_state", field: "state", operator: "==", value: "on" },
      { device_type: "source_presence", field: "water_present", operator: "==", value: false },
    ],
    action: { type: "motor_off", target_device: MOTOR },
  },
  {
    rule_id: "rule_pump_failure_roof",
    name: "Pump on but tank is not filling",
    severity: "pump_failure",
    kind: "pump_failure",
    conditions: [],
    action: { type: "none" },
  },
  {
    rule_id: "rule_low_water_roof",
    name: "Notice when the tank is low",
    severity: "low_water",
    kind: "threshold",
    conditions: [
      { device_type: "tank_level", field: "level_pct", operator: "<=", value: 15 },
      { device_type: "motor_state", field: "state", operator: "==", value: "off" },
    ],
    action: { type: "none" },
  },
  {
    rule_id: "rule_abnormal_flow_roof",
    name: "Flow while the pump is off",
    severity: "abnormal_flow",
    kind: "threshold",
    conditions: [
      { device_type: "motor_state", field: "state", operator: "==", value: "off" },
      { device_type: "water_flow", field: "flow_rate_lpm", operator: ">", value: 0 },
    ],
    action: { type: "none" },
  },
];

async function seed() {
  await connectDb();
  await Tank.updateOne(
    { tank_id: TANK },
    {
      $set: {
        tank_id: TANK,
        home_id: HOME,
        name: "Roof Tank",
        capacity_litres: 1000,
        motor_device_id: MOTOR,
        location: "Roof",
        thresholds: { warning_pct: 90, overflow_pct: 98 },
      },
    },
    { upsert: true }
  );
  for (const device of devices) {
    await Device.updateOne(
      { device_id: device.device_id },
      { $set: { ...device, tank_id: TANK, home_id: HOME } },
      { upsert: true }
    );
  }
  for (const rule of rules) {
    await Rule.updateOne(
      { rule_id: rule.rule_id },
      {
        $set: {
          ...rule,
          home_id: HOME,
          tank_id: TANK,
          logic: "AND",
          escalation: { if_unresolved_seconds: 30 },
          enabled: true,
        },
      },
      { upsert: true }
    );
  }
  await Telemetry.collection.createIndex({ device_id: 1, timestamp: -1 });
  await Incident.collection.createIndex({ home_id: 1, triggered_at: -1 });
  await DeviceLatest.collection.createIndex({ device_id: 1 }, { unique: true });
  console.log("Seeded home_001 / tank_roof_01");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
