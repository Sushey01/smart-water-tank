import { Router } from "express";
import { modelsFor } from "../db.js";
import { blockedAlert } from "../rules/engine.js";
import { withCurrent } from "../services/tankService.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { Tank } = modelsFor("water_tank");
    const filter = req.query.homeId ? { home_id: req.query.homeId } : {};
    const tanks = await Tank.find(filter).lean();
    const withState = await Promise.all(tanks.map(async (tank) => ({
      ...(await withCurrent(tank)),
      blocked: await blockedAlert(tank.tank_id),
    })));
    res.json(withState);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { Tank } = modelsFor("water_tank");
    const { tank_id, home_id, capacity_litres, motor_device_id } = req.body;
    if (!tank_id || !home_id || capacity_litres === undefined || !motor_device_id) {
      throw httpError(400, "tank_id, home_id, capacity_litres, and motor_device_id are required");
    }
    const existing = await Tank.findOne({ tank_id }).lean();
    if (existing) {
      throw httpError(400, "tank_id already exists");
    }
    const tank = await Tank.create(req.body);
    res.status(201).json(tank);
  })
);

router.get(
  "/:tankId",
  asyncHandler(async (req, res) => {
    const { Tank } = modelsFor("water_tank");
    const tank = await Tank.findOne({ tank_id: req.params.tankId }).lean();
    if (!tank) {
      throw httpError(404, "Tank not found");
    }
    res.json({ ...(await withCurrent(tank)), blocked: await blockedAlert(tank.tank_id) });
  })
);

router.put(
  "/:tankId",
  asyncHandler(async (req, res) => {
    const { Tank } = modelsFor("water_tank");
    const tank = await Tank.findOneAndUpdate(
      { tank_id: req.params.tankId },
      { $set: req.body },
      { new: true }
    ).lean();
    if (!tank) {
      throw httpError(404, "Tank not found");
    }
    res.json(await withCurrent(tank));
  })
);

router.delete(
  "/:tankId",
  asyncHandler(async (req, res) => {
    const { Tank } = modelsFor("water_tank");
    const tank = await Tank.findOneAndDelete({ tank_id: req.params.tankId }).lean();
    if (!tank) {
      throw httpError(404, "Tank not found");
    }
    res.json({ deleted: tank.tank_id });
  })
);

export default router;
