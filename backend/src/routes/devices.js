import { Router } from "express";
import { Device } from "../models/index.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.tankId) filter.tank_id = req.query.tankId;
    if (req.query.homeId) filter.home_id = req.query.homeId;
    res.json(await Device.find(filter).lean());
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { device_id, device_type, tank_id, home_id, name } = req.body;
    if (!device_id || !device_type || !tank_id || !home_id || !name) {
      throw httpError(400, "device_id, device_type, tank_id, home_id, and name are required");
    }
    const existing = await Device.findOne({ device_id }).lean();
    if (existing) {
      throw httpError(400, "device_id already exists");
    }
    const device = await Device.create(req.body);
    res.status(201).json(device);
  })
);

router.get(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const device = await Device.findOne({ device_id: req.params.deviceId }).lean();
    if (!device) {
      throw httpError(404, "Device not found");
    }
    res.json(device);
  })
);

router.put(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const device = await Device.findOneAndUpdate(
      { device_id: req.params.deviceId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!device) {
      throw httpError(404, "Device not found");
    }
    res.json(device);
  })
);

router.delete(
  "/:deviceId",
  asyncHandler(async (req, res) => {
    const device = await Device.findOneAndDelete({ device_id: req.params.deviceId }).lean();
    if (!device) {
      throw httpError(404, "Device not found");
    }
    res.json({ deleted: device.device_id });
  })
);

export default router;
