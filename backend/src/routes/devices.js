import { Router } from "express";
import { findAcross, findMerged, resolveSubsystem } from "../db.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.tankId) filter.tank_id = req.query.tankId;
    if (req.query.subsystemId) filter.subsystem_id = req.query.subsystemId;
    if (req.query.homeId) filter.home_id = req.query.homeId;
    const scope = req.query.subsystemId || req.query.tankId;
    if (scope) {
      const route = await resolveSubsystem(scope);
      res.json(route ? await route.models.Device.find(filter).lean() : []);
      return;
    }
    res.json(await findMerged("Device", filter));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const subsystem_id = req.body.subsystem_id || req.body.tank_id;
    const { device_id, device_type, home_id, name } = req.body;
    if (!device_id || !device_type || !subsystem_id || !home_id || !name) {
      throw httpError(400, "device_id, device_type, subsystem_id, home_id, and name are required");
    }
    req.body.subsystem_id = subsystem_id;
    const route = await resolveSubsystem(subsystem_id);
    if (!route) {
      throw httpError(400, `Unknown subsystem '${subsystem_id}'`);
    }
    const existing = await findAcross("Device", { device_id });
    if (existing) {
      throw httpError(400, "device_id already exists");
    }
    const device = await route.models.Device.create(req.body);
    res.status(201).json(device);
  })
);

router.get(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Device", { device_id: req.params.deviceId });
    if (!found) {
      throw httpError(404, "Device not found");
    }
    res.json(found.doc);
  })
);

router.put(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Device", { device_id: req.params.deviceId });
    if (!found) {
      throw httpError(404, "Device not found");
    }
    const device = await found.models.Device.findOneAndUpdate(
      { device_id: req.params.deviceId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    res.json(device);
  })
);

router.delete(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Device", { device_id: req.params.deviceId });
    if (!found) {
      throw httpError(404, "Device not found");
    }
    await found.models.Device.deleteOne({ device_id: req.params.deviceId });
    res.json({ deleted: found.doc.device_id });
  })
);

export default router;
