import { Router } from "express";
import { Incident, Telemetry } from "../models/index.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const homeId = req.query.homeId || "home_001";
    const [facet] = await Incident.aggregate([
      { $match: { home_id: homeId } },
      {
        $facet: {
          by_severity: [{ $group: { _id: "$severity", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          cutoff: [
            {
              $match: {
                "action_taken.status": "success",
                resolved_at: { $ne: null },
              },
            },
            {
              $project: {
                seconds: { $divide: [{ $subtract: ["$resolved_at", "$triggered_at"] }, 1000] },
              },
            },
            { $group: { _id: null, avg_seconds: { $avg: "$seconds" } } },
          ],
          litres: [{ $group: { _id: null, litres_saved: { $sum: "$litres_saved" } } }],
        },
      },
    ]);
    const levels = await Telemetry.aggregate([
      { $match: { home_id: homeId, device_type: "tank_level" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          avg_level_pct: { $avg: "$reading.level_pct" },
          readings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      home_id: homeId,
      by_severity: facet?.by_severity || [],
      avg_detection_to_cutoff_seconds: facet?.cutoff?.[0]?.avg_seconds ?? null,
      litres_saved: facet?.litres?.[0]?.litres_saved ?? 0,
      avg_level_by_day: levels,
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.homeId) filter.home_id = req.query.homeId;
    if (req.query.tankId) filter.tank_id = req.query.tankId;
    if (req.query.severity) filter.severity = req.query.severity;
    const rows = await Incident.find(filter).sort({ triggered_at: -1 }).limit(100).lean();
    res.json(rows);
  })
);

router.get(
  "/:incidentId",
  asyncHandler(async (req, res) => {
    const incident = await Incident.findOne({ incident_id: req.params.incidentId }).lean();
    if (!incident) {
      throw httpError(404, "Incident not found");
    }
    res.json(incident);
  })
);

router.patch(
  "/:incidentId",
  asyncHandler(async (req, res) => {
    const update = {};
    if (req.body.acknowledged === true) {
      update.acknowledged_at = new Date();
    }
    if (req.body.status) {
      update["action_taken.status"] = req.body.status;
    }
    if (!Object.keys(update).length) {
      throw httpError(400, "Send acknowledged: true or a status");
    }
    const incident = await Incident.findOneAndUpdate(
      { incident_id: req.params.incidentId },
      { $set: update },
      { new: true, writeConcern: { w: "majority" } }
    ).lean();
    if (!incident) {
      throw httpError(404, "Incident not found");
    }
    res.json(incident);
  })
);

export default router;
