# Household automations

One home with three automations. The rooftop tank warns at 90% and switches the pump off at 98%, with dry-run, pump-failure, abnormal-flow, and low-tank detection. The study desk sets the lamp to 6500 K at full brightness when someone sits down, and turns it off when the desk is empty. The living room starts cooling above 28°C and stops at 26°C. MongoDB runs as replica set `rs0`. Sensor readings arrive over MQTT. The status page and REST API read them back.

The status page shows litres in the tank and, while the pump is on and water is flowing, the minutes left until the 98% cutoff. From 90% to 98% the person can press Off. If they do not, the rule still switches the pump off at 98%. A phone app is optional and is not part of this build. Telegram is the notice when the bot token and the person's own chat id are set.

## Run

The replica set is already on ports 27017, 27018, and 27019. `npm run dev` starts an MQTT broker on port 1883 when that port is free. If Mosquitto is already running there, the app uses it instead.

Each automation has its own database on `rs0`, all served by the same API:

- `smart_water`: roof tank `tank_roof_01`
- `smart_focus`: study desk `focus_desk_01`
- `smart_climate`: living room `climate_living_01`

Each database has its own `subsystems`, `devices`, `telemetry`, `device_latest`, `automation_rules`, `incidents`, and `notifications`, and `smart_water` also holds `tanks`. `npm run seed` writes each subsystem into its database and moves any desk or climate documents still in `smart_water` across. Home-wide incident and notification lists merge all three, newest first. `GET /api/health` reports each database.

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

In a second terminal:

```bash
npm run simulate -- overflow
```

Other tank scenarios: `normal`, `dry-run`, `pump-failure`, `abnormal-flow`, `fault`.

```bash
npm run simulate -- study
npm run simulate -- cool
```

`study` sits someone at the desk, then leaves. `cool` warms the room past 28°C and lets it cool back to 26°C.

`fault` ignores the off command. After 30 seconds the open cutoff incident is marked `confirmed_fault`.

## API

Base path `/api`.

- `GET /health`
- `GET /subsystems`, `GET /subsystems/:subsystemId`
- `GET|POST /tanks`, `GET|PUT|DELETE /tanks/:tankId`
- `GET|POST /devices`, `GET|PUT|DELETE /devices/:deviceId`
- `GET|POST /rules`, `PUT|DELETE /rules/:ruleId`
- `POST /telemetry`, `GET /telemetry?deviceId=&from=&to=`
- `GET /incidents`, `GET /incidents/stats`, `GET /incidents/:incidentId`, `PATCH /incidents/:incidentId`
- `POST /motors/:deviceId/override` with `{ "command": "on" }` or `{ "command": "off" }`
- `POST /actuators/:deviceId/override` with `{ "command": "study" }` or `{ "command": "off" }` for the desk lamp, and `{ "command": "cool" }` or `{ "command": "off" }` for the air conditioner
- `GET /notifications?homeId=home_001`

`GET /tanks/:tankId` adds litres in the tank, litres left until the 98% cutoff, and minutes to that cutoff. Those figures are calculated from the tank capacity and the latest separate sensor documents.

A rule writes a notification as well as an incident. Pressing Off or On on the status page does the same. Telegram is sent only when `TELEGRAM_BOT_TOKEN` is the full BotFather value (`123456789:AA...`) and `TELEGRAM_CHAT_ID` is your own user id.

Seeded ids: `home_001`, `tank_roof_01`, `motor_roof_01`, `focus_desk_01`, `climate_living_01`.

The decisions and what is already built are in [plan/PLAN.md](plan/PLAN.md).
