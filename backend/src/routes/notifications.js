import { Router } from "express";
import { Notification } from "../models/index.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.homeId) filter.home_id = req.query.homeId;
    if (req.query.tankId) filter.tank_id = req.query.tankId;
    const rows = await Notification.find(filter).sort({ created_at: -1 }).limit(50).lean();
    res.json(rows);
  })
);

export default router;
