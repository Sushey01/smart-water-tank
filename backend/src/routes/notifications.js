import { Router } from "express";
import { findMerged, resolveSubsystem } from "../db.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.homeId) filter.home_id = req.query.homeId;
    if (req.query.tankId) filter.tank_id = req.query.tankId;
    if (req.query.subsystemId) filter.subsystem_id = req.query.subsystemId;
    const scope = req.query.subsystemId || req.query.tankId;
    const options = { sort: { created_at: -1 }, limit: 50 };
    if (scope) {
      const route = await resolveSubsystem(scope);
      if (!route) {
        res.json([]);
        return;
      }
      res.json(await route.models.Notification.find(filter).sort(options.sort).limit(options.limit).lean());
      return;
    }
    res.json(await findMerged("Notification", filter, options));
  })
);

export default router;
