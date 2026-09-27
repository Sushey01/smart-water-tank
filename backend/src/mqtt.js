import mqtt from "mqtt";

let client = null;
let connected = false;

export function isMqttConnected() {
  return connected;
}

export function connectMqtt() {
  const url = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
  client = mqtt.connect(url, { reconnectPeriod: 2000, connectTimeout: 5000 });
  client.on("connect", () => {
    connected = true;
    console.log("MQTT connected");
  });
  client.on("close", () => {
    connected = false;
  });
  client.on("error", (error) => {
    connected = false;
    console.error("MQTT error:", error.message);
  });
  return client;
}

export function publish(topic, payload, options = { qos: 0 }) {
  if (!client || !connected) {
    return false;
  }
  client.publish(topic, JSON.stringify(payload), options);
  return true;
}
