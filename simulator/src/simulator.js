import dotenv from "dotenv";
import mqtt from "mqtt";
import path from "path";
import { fileURLToPath } from "url";
import { telemetryTopic } from "../../backend/src/constants.js";
import { scenarios } from "./scenarios.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const name = process.argv[2] || "overflow";
const scenario = scenarios[name];
if (!scenario) {
  console.error(`Unknown scenario '${name}'. Use: ${Object.keys(scenarios).join(", ")}`);
  process.exit(1);
}

const home_id = "home_001";
const tank_id = "tank_roof_01";
const devices = {
  tank_level: "tank_level_roof_01",
  water_flow: "water_flow_roof_01",
  motor_state: "motor_roof_01",
  source_presence: "source_roof_01",
};

const state = scenario.create();
const url = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const client = mqtt.connect(url);

function levelCm(levelPct) {
  return +((levelPct / 100) * 150).toFixed(1);
}

function publishOne(deviceType, reading) {
  const topic = telemetryTopic({
    home_id,
    tank_id,
    device_type: deviceType,
    device_id: devices[deviceType],
  });
  const body = {
    home_id,
    tank_id,
    device_id: devices[deviceType],
    device_type: deviceType,
    timestamp: new Date().toISOString(),
    reading,
  };
  client.publish(topic, JSON.stringify(body));
}

function publishAll() {
  state.cumulative_litres = +(state.cumulative_litres + state.flow_rate_lpm / 60).toFixed(3);
  publishOne("source_presence", { water_present: state.water_present });
  publishOne("motor_state", { state: state.motor, runtime_seconds: state.runtime_seconds });
  publishOne("water_flow", {
    flow_rate_lpm: state.flow_rate_lpm,
    cumulative_litres: state.cumulative_litres,
    direction: state.flow_rate_lpm > 0 ? state.direction : "inflow",
  });
  publishOne("tank_level", { level_pct: state.level_pct, level_cm: levelCm(state.level_pct) });
  console.log(
    `${name} level=${state.level_pct}% pump=${state.motor} flow=${state.flow_rate_lpm} source=${state.water_present}`
  );
}

client.on("connect", () => {
  const commandTopic = `ioThings/${home_id}/${tank_id}/motor/${devices.motor_state}/command`;
  client.subscribe(commandTopic, { qos: 1 });
  console.log(`Simulator '${name}' publishing to Mosquitto`);
  publishAll();
  setInterval(() => {
    scenario.step(state);
    publishAll();
  }, 1000);
});

client.on("message", (topic, buffer) => {
  if (!topic.endsWith("/command")) {
    return;
  }
  const message = JSON.parse(buffer.toString());
  if (scenario.ignoreCommand) {
    console.log(`Ignored pump command '${message.command}'`);
    return;
  }
  if (message.command === "off") {
    state.motor = "off";
    state.flow_rate_lpm = 0;
  }
  if (message.command === "on") {
    state.motor = "on";
  }
  console.log(`Pump command applied: ${message.command}`);
  publishAll();
});

client.on("error", (error) => {
  console.error("MQTT error:", error.message);
  process.exit(1);
});
