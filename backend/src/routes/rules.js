import { Router } from "express";
import { Rule } from "../models/index.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = req.query.tankId ? { tank_id: req.query.tankId } : {};
    res.json(await Rule.find(filter).lean());
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { rule_id, home_id, tank_id, name, severity } = req.body;
    if (!rule_id || !home_id || !tank_id || !name || !severity) {
      throw httpError(400, "rule_id, home_id, tank_id, name, and severity are required");
    }
    const existing = await Rule.findOne({ rule_id }).lean();
    if (existing) {
      throw httpError(400, "rule_id already exists");
    }
    const rule = await Rule.create(req.body);
    res.status(201).json(rule);
  })
);

router.put(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const rule = await Rule.findOneAndUpdate(
      { rule_id: req.params.ruleId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!rule) {
      throw httpError(404, "Rule not found");
    }
    res.json(rule);
  })
);

router.delete(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const rule = await Rule.findOneAndDelete({ rule_id: req.params.ruleId }).lean();
    if (!rule) {
      throw httpError(404, "Rule not found");
    }
    res.json({ deleted: rule.rule_id });
  })
);

export default router;
