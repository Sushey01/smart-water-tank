import { Router } from "express";
import { allStores, findAcross, findMerged, modelsFor, resolveSubsystem } from "../db.js";
import { asyncHandler, httpError } from "../middleware/errorHandler.js";

const router = Router();

function incidentFacet(Incident, match) {
  return Incident.aggregate([
    { $match: match },
    {
      $facet: {
        by_severity: [{ $group: { _id: "$severity", count: { $sum: 1 } } }],
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
          { $group: { _id: null, total_seconds: { $sum: "$seconds" }, count: { $sum: 1 } } },
        ],
        litres: [{ $group: { _id: null, litres_saved: { $sum: "$litres_saved" } } }],
      },
    },
  ]);
}

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const homeId = req.query.homeId || "home_001";
    const match = { home_id: homeId };
    if (req.query.tankId) match.tank_id = req.query.tankId;
    const stores = req.query.tankId ? [{ models: modelsFor("water_tank") }] : allStores();
    const facets = await Promise.all(stores.map((store) => incidentFacet(store.models.Incident, match)));
    const bySeverity = new Map();
    let cutoffSeconds = 0;
    let cutoffCount = 0;
    let litresSaved = 0;
    for (const [facet] of facets) {
      for (const row of facet?.by_severity || []) {
        bySeverity.set(row._id, (bySeverity.get(row._id) || 0) + row.count);
      }
      cutoffSeconds += facet?.cutoff?.[0]?.total_seconds || 0;
      cutoffCount += facet?.cutoff?.[0]?.count || 0;
      litresSaved += facet?.litres?.[0]?.litres_saved || 0;
    }
    const levels = await modelsFor("water_tank").Telemetry.aggregate([
      { $match: { home_id: homeId, device_type: "tank_level", ...(req.query.tankId ? { tank_id: req.query.tankId } : {}) } },
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
      by_severity: [...bySeverity]
        .map(([severity, count]) => ({ _id: severity, count }))
        .sort((a, b) => String(a._id).localeCompare(String(b._id))),
      avg_detection_to_cutoff_seconds: cutoffCount ? cutoffSeconds / cutoffCount : null,
      litres_saved: litresSaved,
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
    if (req.query.subsystemId) filter.subsystem_id = req.query.subsystemId;
    if (req.query.severity) filter.severity = req.query.severity;
    const scope = req.query.subsystemId || req.query.tankId;
    const options = { sort: { triggered_at: -1 }, limit: 100 };
    if (scope) {
      const route = await resolveSubsystem(scope);
      if (!route) {
        res.json([]);
        return;
      }
      res.json(await route.models.Incident.find(filter).sort(options.sort).limit(options.limit).lean());
      return;
    }
    res.json(await findMerged("Incident", filter, options));
  })
);

router.get(
  "/:incidentId",
  asyncHandler(async (req, res) => {
    const found = await findAcross("Incident", { incident_id: req.params.incidentId });
    if (!found) {
      throw httpError(404, "Incident not found");
    }
    res.json(found.doc);
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
    const found = await findAcross("Incident", { incident_id: req.params.incidentId });
    if (!found) {
      throw httpError(404, "Incident not found");
    }
    const incident = await found.models.Incident.findOneAndUpdate(
      { incident_id: req.params.incidentId },
      { $set: update },
      { new: true, writeConcern: { w: "majority" } }
    ).lean();
    res.json(incident);
  })
);

export default router;
