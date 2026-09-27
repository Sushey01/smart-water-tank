import { Router } from "express";
import { commandTopic } from "../constants.js";
import { isMqttConnected, publish } from "../mqtt.js";
import { Device, Incident } from "../models/index.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.post(
  "/:deviceId/override",
  asyncHandler(async (req, res) => {
    const command = req.body.command;
    if (command !== "on" && command !== "off") {
      throw httpError(400, "command must be on or off");
    }
    const device = await Device.findOne({ device_id: req.params.deviceId }).lean();
    if (!device) {
      throw httpError(404, "Device not found");
    }
    if (device.device_type !== "motor_state") {
      throw httpError(400, "Override applies to the pump device only");
    }
    const incident = new Incident({
      incident_id: `inc_${Date.now()}`,
      home_id: device.home_id,
      tank_id: device.tank_id,
      severity: "manual_override",
      origin_severity: "manual_override",
      triggered_at: new Date(),
      triggered_by: [{ device_id: device.device_id, command }],
      action_taken: {
        type: command === "off" ? "motor_off" : "motor_on",
        target_device: device.device_id,
        status: "pending",
      },
      open: true,
    });
    if (!isMqttConnected()) {
      incident.action_taken.status = "mqtt_unavailable";
      await incident.save({ writeConcern: { w: "majority" } });
      throw httpError(503, "MQTT broker is not connected");
    }
    publish(
      commandTopic({
        home_id: device.home_id,
        tank_id: device.tank_id,
        device_id: device.device_id,
      }),
      { command, reason: "manual_override", incident_id: incident.incident_id },
      { qos: 1 }
    );
    await incident.save({ writeConcern: { w: "majority" } });
    res.status(201).json(incident);
  })
);

export default router;
