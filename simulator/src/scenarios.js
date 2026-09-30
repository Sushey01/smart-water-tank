function base() {
  return {
    level_pct: 20,
    flow_rate_lpm: 0,
    cumulative_litres: 0,
    motor: "off",
    water_present: true,
    runtime_seconds: 0,
    direction: "inflow",
  };
}

export const scenarios = {
  normal: {
    ignoreCommand: false,
    create() {
      return { ...base(), motor: "on", flow_rate_lpm: 12, direction: "inflow" };
    },
    step(state) {
      if (state.motor === "on" && state.level_pct < 80) {
        state.level_pct = Math.min(80, state.level_pct + 5);
        state.flow_rate_lpm = 12;
        state.direction = "inflow";
        state.runtime_seconds += 1;
        return;
      }
      state.motor = "off";
      state.flow_rate_lpm = 0;
      state.level_pct = Math.max(15, state.level_pct - 1);
    },
  },
  overflow: {
    ignoreCommand: false,
    create() {
      return { ...base(), level_pct: 80, motor: "on", flow_rate_lpm: 15, direction: "inflow" };
    },
    step(state) {
      if (state.motor !== "on") {
        state.flow_rate_lpm = 0;
        return;
      }
      state.level_pct = Math.min(99, +(state.level_pct + 3).toFixed(1));
      state.flow_rate_lpm = 15;
      state.direction = "inflow";
      state.runtime_seconds += 1;
    },
  },
  "dry-run": {
    ignoreCommand: false,
    create() {
      return { ...base(), motor: "on", water_present: false, flow_rate_lpm: 0, level_pct: 40 };
    },
    step(state) {
      if (state.motor === "on") {
        state.runtime_seconds += 1;
      }
      state.water_present = false;
      state.flow_rate_lpm = 0;
    },
  },
  "pump-failure": {
    ignoreCommand: false,
    create() {
      return { ...base(), motor: "on", water_present: true, flow_rate_lpm: 0, level_pct: 45 };
    },
    step(state) {
      if (state.motor === "on") {
        state.runtime_seconds += 1;
      }
      state.flow_rate_lpm = 0;
      state.water_present = true;
    },
  },
  "abnormal-flow": {
    ignoreCommand: false,
    create() {
      return { ...base(), motor: "off", water_present: true, flow_rate_lpm: 5, level_pct: 70, direction: "inflow" };
    },
    step(state) {
      state.motor = "off";
      state.flow_rate_lpm = 5;
      state.direction = "inflow";
      state.level_pct = Math.min(99, +(state.level_pct + 0.2).toFixed(1));
    },
  },
  study: {
    room: "focus",
    ignoreCommand: false,
    create() {
      return {
        ticks: 0,
        present: false,
        lux: 140,
        lamp: "off",
        mode: "off",
        color_temp_k: 0,
        brightness_pct: 0,
      };
    },
    step(state) {
      state.ticks += 1;
      if (state.ticks === 4) {
        state.present = true;
        if (state.lamp !== "on") state.lux = 80;
      }
      if (state.ticks === 14) {
        state.present = false;
      }
    },
  },
  cool: {
    room: "climate",
    ignoreCommand: false,
    create() {
      return { temp_c: 27, hvac: "off" };
    },
    step(state) {
      if (state.hvac === "cooling") {
        state.temp_c = Math.max(24, +(state.temp_c - 0.5).toFixed(1));
        return;
      }
      state.temp_c = Math.min(32, +(state.temp_c + 0.6).toFixed(1));
    },
  },
  fault: {
    ignoreCommand: true,
    create() {
      return { ...base(), level_pct: 94, motor: "on", flow_rate_lpm: 15, direction: "inflow" };
    },
    step(state) {
      state.motor = "on";
      state.level_pct = Math.min(99, +(state.level_pct + 2).toFixed(1));
      state.flow_rate_lpm = 15;
      state.direction = "inflow";
      state.runtime_seconds += 1;
    },
  },
};
