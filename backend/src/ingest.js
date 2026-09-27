import { recordFromTopic } from "./services/telemetryService.js";

export function startIngest(client) {
  client.subscribe("ioThings/+/+/+/+/telemetry", { qos: 0 });
  client.on("message", (topic, buffer) => {
    if (!topic.endsWith("/telemetry")) {
      return;
    }
    let body;
    try {
      body = JSON.parse(buffer.toString());
    } catch {
      console.error("Rejected non-JSON telemetry on", topic);
      return;
    }
    recordFromTopic(topic, body).catch((error) => {
      console.error("Ingest rejected:", error.message);
    });
  });
}
