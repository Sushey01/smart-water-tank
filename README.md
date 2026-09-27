# Smart household water tank

A simulated rooftop tank that warns at 90% and switches the pump off at 98%, with dry-run, pump-failure, abnormal-flow, and low-tank detection. MongoDB runs as replica set `rs0`. Sensor readings arrive over MQTT. The status page and REST API read them back.

The status page shows litres in the tank and, while the pump is on and water is flowing, the minutes left until the 98% cutoff. From 90% to 98% the person can press Off. If they do not, the rule still switches the pump off at 98%. A phone app is optional and is not part of this build. Telegram is the notice when the bot token and the person's own chat id are set.

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
npm run simulate -- overflow
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
- `POST /motors/:deviceId/override` with `{ "command": "on" }` or `{ "command": "off" }`
- `GET /notifications?homeId=home_001`

`GET /tanks/:tankId` adds litres in the tank, litres left until the 98% cutoff, and minutes to that cutoff. Those figures are calculated from the tank capacity and the latest separate sensor documents.

A rule writes a notification as well as an incident. Pressing Off or On on the status page does the same. Telegram is sent only when `TELEGRAM_BOT_TOKEN` is the full BotFather value (`123456789:AA...`) and `TELEGRAM_CHAT_ID` is your own user id.

Seeded ids: `home_001`, `tank_roof_01`, `motor_roof_01`.

The decisions and what is already built are in [plan/PLAN.md](plan/PLAN.md).
