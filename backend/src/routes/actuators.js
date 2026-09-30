import { Router } from "express";
import { commandTopic } from "../constants.js";
import { isMqttConnected, publish } from "../mqtt.js";
import { findAcross } from "../db.js";
import { notify } from "../services/notificationService.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

const COMMANDS = {
  desk_lamp: {
    study: { type: "lamp_study", payload: { command: "study", mode: "study", color_temp_k: 6500, brightness_pct: 100 } },
    off: { type: "lamp_off", payload: { command: "off" } },
  },
  hvac: {
    cool: { type: "hvac_on", payload: { command: "cool" } },
    off: { type: "hvac_off", payload: { command: "off" } },
  },
};

router.post(
  "/:deviceId/override",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Device", { device_id: req.params.deviceId });
    if (!found) {
      throw httpError(404, "Device not found");
    }
    const device = found.doc;
    const { DeviceLatest, Incident } = found.models;
    const allowed = COMMANDS[device.device_type];
    const chosen = allowed?.[req.body.command];
    if (!chosen) {
      const names = allowed ? Object.keys(allowed).join(" or ") : "a lamp or air conditioner";
      throw httpError(400, `command must be ${names}`);
    }
    const incident = new Incident({
      incident_id: `inc_${Date.now()}`,
      home_id: device.home_id,
      subsystem_id: device.subsystem_id,
      severity: "manual_override",
      origin_severity: "manual_override",
      triggered_at: new Date(),
      triggered_by: [{ device_id: device.device_id, command: req.body.command }],
      action_taken: {
        type: chosen.type,
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
    const sent = publish(
      commandTopic({
        home_id: device.home_id,
        subsystem_id: device.subsystem_id,
        device_type: device.device_type,
        device_id: device.device_id,
      }),
      { ...chosen.payload, reason: "manual_override", incident_id: incident.incident_id },
      { qos: 1 }
    );
    if (!sent) {
      incident.action_taken.status = "mqtt_unavailable";
      await incident.save({ writeConcern: { w: "majority" } });
      throw httpError(503, "MQTT broker is not connected");
    }
    await incident.save({ writeConcern: { w: "majority" } });
    const latests = await DeviceLatest.find({ subsystem_id: device.subsystem_id }).lean();
    await notify(incident.toObject(), latests);
    res.status(201).json(incident);
  })
);

export default router;
