# Smart household water tank

A simulated rooftop tank that warns at 90% and switches the pump off at 98%, with dry-run, pump-failure, and abnormal-flow detection. MongoDB runs as replica set `rs0`. Sensor readings arrive over MQTT. The status page and REST API read them back.

## Run

The replica set is already on ports 27017, 27018, and 27019. `npm run dev` starts an MQTT broker on port 1883 when that port is free. If Mosquitto is already running there, the app uses it instead.

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

In a second terminal:

```bash
npm run simulate overflow
```

Other scenarios: `normal`, `dry-run`, `pump-failure`, `abnormal-flow`, `fault`.

`fault` ignores the off command. After 30 seconds the open cutoff incident is marked `confirmed_fault`.

## API

Base path `/api`.

- `GET /health`
- `GET|POST /tanks`, `GET|PUT|DELETE /tanks/:tankId`
- `GET|POST /devices`, `GET|PUT|DELETE /devices/:deviceId`
- `GET|POST /rules`, `PUT|DELETE /rules/:ruleId`
- `POST /telemetry`, `GET /telemetry?deviceId=&from=&to=`
- `GET /incidents`, `GET /incidents/stats`, `GET /incidents/:incidentId`, `PATCH /incidents/:incidentId`
- `POST /motors/:deviceId/override` with `{ "command": "off" }`

Seeded ids: `home_001`, `tank_roof_01`, `motor_roof_01`.

The decisions and what is already built are in [plan/PLAN.md](plan/PLAN.md).
