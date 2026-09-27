import { Router } from "express";
import { Telemetry } from "../models/index.js";
import { recordSerialized } from "../services/telemetryService.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const saved = await recordSerialized(req.body);
    res.status(201).json(saved);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.query.deviceId) {
      throw httpError(400, "deviceId query parameter is required");
    }
    const filter = { device_id: req.query.deviceId };
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await Telemetry.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
    res.json(rows);
  })
);

export default router;
