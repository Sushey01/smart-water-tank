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
const url = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const client = mqtt.connect(url);

function publishReading(subsystem_id, device_type, device_id, reading, tank_id) {
  const topic = telemetryTopic({ home_id, subsystem_id, device_type, device_id });
  const body = {
    home_id,
    subsystem_id,
    device_id,
    device_type,
    timestamp: new Date().toISOString(),
    reading,
  };
  if (tank_id) body.tank_id = tank_id;
  client.publish(topic, JSON.stringify(body));
}

function runWater() {
  const tank_id = "tank_roof_01";
  const devices = {
    tank_level: "tank_level_roof_01",
    water_flow: "water_flow_roof_01",
    motor_state: "motor_roof_01",
    source_presence: "source_roof_01",
  };
  const state = scenario.create();

  function levelCm(levelPct) {
    return +((levelPct / 100) * 150).toFixed(1);
  }

  function publishAll() {
    state.cumulative_litres = +(state.cumulative_litres + state.flow_rate_lpm / 60).toFixed(3);
    publishReading(tank_id, "source_presence", devices.source_presence, { water_present: state.water_present }, tank_id);
    publishReading(tank_id, "motor_state", devices.motor_state, { state: state.motor, runtime_seconds: state.runtime_seconds }, tank_id);
    publishReading(
      tank_id,
      "water_flow",
      devices.water_flow,
      {
        flow_rate_lpm: state.flow_rate_lpm,
        cumulative_litres: state.cumulative_litres,
        direction: state.flow_rate_lpm > 0 ? state.direction : "inflow",
      },
      tank_id
    );
    publishReading(tank_id, "tank_level", devices.tank_level, { level_pct: state.level_pct, level_cm: levelCm(state.level_pct) }, tank_id);
    console.log(
      `${name} level=${state.level_pct}% pump=${state.motor} flow=${state.flow_rate_lpm} source=${state.water_present}`
    );
  }

  client.on("connect", () => {
    const commandTopic = `ioThings/${home_id}/${tank_id}/motor_state/${devices.motor_state}/command`;
    client.subscribe(commandTopic, { qos: 1 });
    console.log(`Simulator '${name}' publishing to Mosquitto`);
    publishAll();
    setInterval(() => {
      scenario.step(state);
      publishAll();
    }, 1000);
  });

  client.on("message", (topic, buffer) => {
    if (!topic.endsWith("/command")) return;
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
}

function runFocus() {
  const subsystem_id = "focus_desk_01";
  const state = scenario.create();

  function publishAll() {
    publishReading(subsystem_id, "desk_presence", "desk_presence_01", { present: state.present });
    publishReading(subsystem_id, "ambient_light", "ambient_light_01", { lux: state.lux });
    publishReading(subsystem_id, "desk_lamp", "desk_lamp_01", {
      state: state.lamp,
      mode: state.mode,
      color_temp_k: state.color_temp_k,
      brightness_pct: state.brightness_pct,
    });
    console.log(
      `${name} present=${state.present} lux=${state.lux} lamp=${state.lamp} mode=${state.mode} ${state.color_temp_k}K ${state.brightness_pct}%`
    );
  }

  client.on("connect", () => {
    client.subscribe(`ioThings/${home_id}/${subsystem_id}/desk_lamp/desk_lamp_01/command`, { qos: 1 });
    console.log(`Simulator '${name}' publishing to Mosquitto`);
    publishAll();
    setInterval(() => {
      scenario.step(state);
      publishAll();
    }, 1000);
  });

  client.on("message", (topic, buffer) => {
    if (!topic.endsWith("/command")) return;
    const message = JSON.parse(buffer.toString());
    if (message.command === "study") {
      state.lamp = "on";
      state.mode = "study";
      state.color_temp_k = message.color_temp_k || 6500;
      state.brightness_pct = message.brightness_pct ?? 100;
      state.lux = 480;
    }
    if (message.command === "off") {
      state.lamp = "off";
      state.mode = "off";
      state.color_temp_k = 0;
      state.brightness_pct = 0;
      state.lux = state.present ? 80 : 140;
    }
    console.log(`Lamp command applied: ${message.command}`);
    publishAll();
  });
}

function runClimate() {
  const subsystem_id = "climate_living_01";
  const state = scenario.create();

  function publishAll() {
    publishReading(subsystem_id, "room_temperature", "room_temp_01", { temp_c: state.temp_c });
    publishReading(subsystem_id, "hvac", "hvac_living_01", { state: state.hvac });
    console.log(`${name} temp=${state.temp_c}C hvac=${state.hvac}`);
  }

  client.on("connect", () => {
    client.subscribe(`ioThings/${home_id}/${subsystem_id}/hvac/hvac_living_01/command`, { qos: 1 });
    console.log(`Simulator '${name}' publishing to Mosquitto`);
    publishAll();
    setInterval(() => {
      scenario.step(state);
      publishAll();
    }, 1000);
  });

  client.on("message", (topic, buffer) => {
    if (!topic.endsWith("/command")) return;
    const message = JSON.parse(buffer.toString());
    if (message.command === "cool") state.hvac = "cooling";
    if (message.command === "off") state.hvac = "off";
    console.log(`Air conditioner command applied: ${message.command}`);
    publishAll();
  });
}

if (scenario.room === "focus") runFocus();
else if (scenario.room === "climate") runClimate();
else runWater();

client.on("error", (error) => {
  console.error("MQTT error:", error.message);
  process.exit(1);
});
