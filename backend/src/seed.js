import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { DATABASES, allStores, connectDb, modelsFor } from "./db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const HOME = "home_001";
const TANK = "tank_roof_01";
const MOTOR = "motor_roof_01";
const FOCUS = "focus_desk_01";
const CLIMATE = "climate_living_01";
const LAMP = "desk_lamp_01";
const HVAC = "hvac_living_01";

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

const roomDevices = [
  { device_id: "desk_presence_01", device_type: "desk_presence", name: "Desk presence", subsystem_id: FOCUS },
  { device_id: "ambient_light_01", device_type: "ambient_light", name: "Desk light level", subsystem_id: FOCUS },
  { device_id: LAMP, device_type: "desk_lamp", name: "Desk lamp", subsystem_id: FOCUS },
  { device_id: "room_temp_01", device_type: "room_temperature", name: "Living room temperature", subsystem_id: CLIMATE },
  { device_id: HVAC, device_type: "hvac", name: "Living room air conditioner", subsystem_id: CLIMATE },
];

const roomRules = [
  {
    rule_id: "rule_study_lamp",
    subsystem_id: FOCUS,
    name: "Study light when someone sits down",
    severity: "study_mode",
    conditions: [{ device_type: "desk_presence", field: "present", operator: "==", value: true }],
    action: { type: "lamp_study", target_device: LAMP },
  },
  {
    rule_id: "rule_lamp_off",
    subsystem_id: FOCUS,
    name: "Lamp off when the desk is empty",
    severity: "lamp_idle",
    conditions: [{ device_type: "desk_presence", field: "present", operator: "==", value: false }],
    action: { type: "lamp_off", target_device: LAMP },
  },
  {
    rule_id: "rule_cool_on",
    subsystem_id: CLIMATE,
    name: "Cool the room above 28",
    severity: "cooling_started",
    conditions: [
      { device_type: "room_temperature", field: "temp_c", operator: ">", value: 28 },
      { device_type: "hvac", field: "state", operator: "==", value: "off" },
    ],
    action: { type: "hvac_on", target_device: HVAC },
  },
  {
    rule_id: "rule_cool_off",
    subsystem_id: CLIMATE,
    name: "Stop cooling at 26",
    severity: "cooling_stopped",
    conditions: [
      { device_type: "room_temperature", field: "temp_c", operator: "<=", value: 26 },
      { device_type: "hvac", field: "state", operator: "==", value: "cooling" },
    ],
    action: { type: "hvac_off", target_device: HVAC },
  },
];

const subsystems = [
  { subsystem_id: TANK, type: "water_tank", name: "Roof tank", config: { tank_id: TANK } },
  {
    subsystem_id: FOCUS,
    type: "focus_room",
    name: "Study desk",
    config: { color_temp_k: 6500, brightness_pct: 100 },
  },
  {
    subsystem_id: CLIMATE,
    type: "climate",
    name: "Living room",
    config: { cool_above_c: 28, resume_below_c: 26 },
  },
];

const TYPE_OF = Object.fromEntries(subsystems.map((subsystem) => [subsystem.subsystem_id, subsystem.type]));

const MOVED_MODELS = ["Subsystem", "Device", "Telemetry", "DeviceLatest", "Rule", "Incident", "Notification"];

async function moveOutOfWater(subsystemId) {
  const water = modelsFor("water_tank");
  const target = modelsFor(TYPE_OF[subsystemId]);
  let moved = 0;
  for (const name of MOVED_MODELS) {
    const source = water[name].collection;
    const docs = await source.find({ subsystem_id: subsystemId }).toArray();
    for (let i = 0; i < docs.length; i += 1000) {
      const batch = docs.slice(i, i + 1000);
      await target[name].collection.bulkWrite(
        batch.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
        { ordered: false }
      );
      await source.deleteMany({ _id: { $in: batch.map((doc) => doc._id) } });
    }
    moved += docs.length;
  }
  if (moved) {
    console.log(`Moved ${moved} ${subsystemId} documents from smart_water to ${DATABASES[TYPE_OF[subsystemId]]}`);
  }
}

async function seed() {
  await connectDb();
  await moveOutOfWater(FOCUS);
  await moveOutOfWater(CLIMATE);

  const water = modelsFor("water_tank");
  await water.Tank.updateOne(
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
  for (const subsystem of subsystems) {
    await modelsFor(subsystem.type).Subsystem.updateOne(
      { subsystem_id: subsystem.subsystem_id },
      { $set: { ...subsystem, home_id: HOME } },
      { upsert: true }
    );
  }
  for (const device of devices) {
    await water.Device.updateOne(
      { device_id: device.device_id },
      { $set: { ...device, subsystem_id: TANK, tank_id: TANK, home_id: HOME } },
      { upsert: true }
    );
  }
  for (const device of roomDevices) {
    await modelsFor(TYPE_OF[device.subsystem_id]).Device.updateOne(
      { device_id: device.device_id },
      { $set: { ...device, home_id: HOME } },
      { upsert: true }
    );
  }
  for (const rule of rules) {
    await water.Rule.updateOne(
      { rule_id: rule.rule_id },
      {
        $set: {
          ...rule,
          home_id: HOME,
          subsystem_id: TANK,
          tank_id: TANK,
          logic: "AND",
          escalation: { if_unresolved_seconds: 30 },
          enabled: true,
        },
      },
      { upsert: true }
    );
  }
  for (const rule of roomRules) {
    await modelsFor(TYPE_OF[rule.subsystem_id]).Rule.updateOne(
      { rule_id: rule.rule_id },
      {
        $set: {
          ...rule,
          home_id: HOME,
          logic: "AND",
          enabled: true,
        },
      },
      { upsert: true }
    );
  }
  for (const store of allStores()) {
    const { DeviceLatest, Incident, Notification, Telemetry } = store.models;
    await Telemetry.collection.createIndex({ device_id: 1, timestamp: -1 });
    await Incident.collection.createIndex({ home_id: 1, triggered_at: -1 });
    await Notification.collection.createIndex({ home_id: 1, created_at: -1 });
    await DeviceLatest.collection.createIndex({ device_id: 1 }, { unique: true });
  }
  console.log(`Seeded home_001: ${TANK} -> smart_water, ${FOCUS} -> smart_focus, ${CLIMATE} -> smart_climate`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
