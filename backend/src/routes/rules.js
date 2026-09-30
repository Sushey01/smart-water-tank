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
    const scope = req.query.subsystemId || req.query.tankId;
    if (scope) {
      const route = await resolveSubsystem(scope);
      res.json(route ? await route.models.Rule.find(filter).lean() : []);
      return;
    }
    res.json(await findMerged("Rule", filter));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const subsystem_id = req.body.subsystem_id || req.body.tank_id;
    const { rule_id, home_id, name, severity } = req.body;
    if (!rule_id || !home_id || !subsystem_id || !name || !severity) {
      throw httpError(400, "rule_id, home_id, subsystem_id, name, and severity are required");
    }
    req.body.subsystem_id = subsystem_id;
    const route = await resolveSubsystem(subsystem_id);
    if (!route) {
      throw httpError(400, `Unknown subsystem '${subsystem_id}'`);
    }
    const existing = await findAcross("Rule", { rule_id });
    if (existing) {
      throw httpError(400, "rule_id already exists");
    }
    const rule = await route.models.Rule.create(req.body);
    res.status(201).json(rule);
  })
);

router.put(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Rule", { rule_id: req.params.ruleId });
    if (!found) {
      throw httpError(404, "Rule not found");
    }
    const rule = await found.models.Rule.findOneAndUpdate(
      { rule_id: req.params.ruleId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    res.json(rule);
  })
);

router.delete(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Rule", { rule_id: req.params.ruleId });
    if (!found) {
      throw httpError(404, "Rule not found");
    }
    await found.models.Rule.deleteOne({ rule_id: req.params.ruleId });
    res.json({ deleted: found.doc.rule_id });
  })
);

export default router;
