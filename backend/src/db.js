import mongoose from "mongoose";
import { registerModels } from "./models/index.js";

export const DATABASES = {
  water_tank: "smart_water",
  focus_room: "smart_focus",
  climate: "smart_climate",
};

const stores = {};
const subsystemTypes = new Map();

export async function connectDb() {
  const uri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/smart_water?replicaSet=rs0";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    readPreference: "primary",
    serverSelectionTimeoutMS: 8000,
  });
  for (const [type, name] of Object.entries(DATABASES)) {
    const connection = mongoose.connection.useDb(name, { useCache: true });
    stores[type] = {
      type,
      name,
      connection,
      models: registerModels(connection, { withTanks: type === "water_tank" }),
    };
  }
  return mongoose.connection;
}

export function modelsFor(type) {
  const store = stores[type];
  if (!store) {
    throw new Error(`No database for subsystem type '${type}'`);
  }
  return store.models;
}

export function allStores() {
  return Object.values(stores);
}

export async function resolveSubsystem(subsystemId) {
  if (!subsystemId) {
    return null;
  }
  const cached = subsystemTypes.get(subsystemId);
  if (cached) {
    const subsystem = await modelsFor(cached).Subsystem.findOne({ subsystem_id: subsystemId }).lean();
    return { type: cached, subsystem, models: modelsFor(cached) };
  }
  for (const store of allStores()) {
    const subsystem = await store.models.Subsystem.findOne({ subsystem_id: subsystemId }).lean();
    if (subsystem) {
      subsystemTypes.set(subsystemId, store.type);
      return { type: store.type, subsystem, models: store.models };
    }
  }
  const tank = await modelsFor("water_tank").Tank.findOne({ tank_id: subsystemId }).lean();
  if (tank) {
    subsystemTypes.set(subsystemId, "water_tank");
    return { type: "water_tank", subsystem: null, models: modelsFor("water_tank") };
  }
  return null;
}

export async function findAcross(modelName, filter) {
  for (const store of allStores()) {
    const doc = await store.models[modelName].findOne(filter).lean();
    if (doc) {
      return { doc, models: store.models, type: store.type };
    }
  }
  return null;
}

export async function findMerged(modelName, filter, { sort, limit } = {}) {
  const lists = await Promise.all(
    allStores().map((store) => {
      let query = store.models[modelName].find(filter);
      if (sort) query = query.sort(sort);
      if (limit) query = query.limit(limit);
      return query.lean();
    })
  );
  let rows = lists.flat();
  if (sort) {
    const [[field, direction]] = Object.entries(sort);
    rows.sort((a, b) => (a[field] < b[field] ? -direction : a[field] > b[field] ? direction : 0));
  }
  if (limit) rows = rows.slice(0, limit);
  return rows;
}

export async function databaseStatus() {
  const result = {};
  for (const store of allStores()) {
    let status = "disconnected";
    if (store.connection.readyState === 1) {
      try {
        await store.connection.db.command({ ping: 1 });
        status = "connected";
      } catch {
        status = "disconnected";
      }
    }
    result[store.name] = status;
  }
  return result;
}
