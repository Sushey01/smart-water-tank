import { Router } from "express";
import { findMerged, modelsFor, resolveSubsystem } from "../db.js";
import { blockedAlert } from "../rules/engine.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

function field(latests, deviceType, name) {
  const doc = latests.find((item) => item.device_type === deviceType);
  return doc?.reading?.[name] ?? null;
}

function currentFor(subsystem, latests) {
  if (subsystem.type === "focus_room") {
    return {
      present: field(latests, "desk_presence", "present"),
      lux: field(latests, "ambient_light", "lux"),
      lamp_state: field(latests, "desk_lamp", "state"),
      mode: field(latests, "desk_lamp", "mode"),
      color_temp_k: field(latests, "desk_lamp", "color_temp_k"),
      brightness_pct: field(latests, "desk_lamp", "brightness_pct"),
    };
  }
  if (subsystem.type === "climate") {
    return {
      temp_c: field(latests, "room_temperature", "temp_c"),
      hvac_state: field(latests, "hvac", "state"),
    };
  }
  return {};
}

async function withCurrent(subsystem) {
  const { DeviceLatest } = modelsFor(subsystem.type);
  const latests = await DeviceLatest.find({ subsystem_id: subsystem.subsystem_id }).lean();
  return {
    ...subsystem,
    current: currentFor(subsystem, latests),
    blocked: await blockedAlert(subsystem.subsystem_id),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.homeId) filter.home_id = req.query.homeId;
    if (req.query.type) filter.type = req.query.type;
    const subsystems = await findMerged("Subsystem", filter);
    res.json(await Promise.all(subsystems.map(withCurrent)));
  })
);

router.get(
  "/:subsystemId",
  asyncHandler(async (req, res) => {
    const route = await resolveSubsystem(req.params.subsystemId);
    if (!route?.subsystem) {
      throw httpError(404, "Subsystem not found");
    }
    res.json(await withCurrent(route.subsystem));
  })
);

export default router;
