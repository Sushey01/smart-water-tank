# Household automations

One home with three automations. The rooftop tank warns at 90% and switches the pump off at 98%, with dry-run, pump-failure, abnormal-flow, and low-tank detection. The study desk sets the lamp to 6500 K at full brightness when someone sits down, and turns it off when the desk is empty. The living room starts cooling above 28°C and stops at 26°C. MongoDB runs as replica set `rs0`. Sensor readings arrive over MQTT. The status page and REST API read them back.

The status page shows litres in the tank and, while the pump is on and water is flowing, the minutes left until the 98% cutoff. From 90% to 98% the person can press Off. If they do not, the rule still switches the pump off at 98%. A phone app is optional and is not part of this build. Telegram is the notice when the bot token and the person's own chat id are set.

Press **Sound on** once in the top bar. Browsers will not play audio until that click. After that, a new fault (overflow, dry-run, pump failure, abnormal flow, or confirmed fault) plays a siren and flashes the panel. A warning plays two short tones. Other notices, such as study mode or cooling, play one soft tone. **Sound off** keeps the banner and stops the noise. The first load does not replay old alerts.

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

## Free the database ports now, recreate later

This project runs a three-node MongoDB replica set on ports 27017, 27018, and 27019. To use those ports in another project, stop this project's database nodes and remove their data. Stopping `mongod` releases the ports; deleting the data folders permanently removes this project's databases, telemetry, incidents, and notifications. Do not delete `mongodb/config`, `mongodb/logs`, or `scripts`.

### Free the ports

Stop the API and simulator with Ctrl+C in their terminals, then run:

```bash
bash scripts/replica-down.sh
rm -rf mongodb/node1/data mongodb/node2/data mongodb/node3/data
```

The MongoDB ports are now available for the other project. You can leave the other project running; these steps do not change its data.

### Recreate this project's database later

After the other project no longer uses ports 27017, 27018, and 27019, run the following from this repository. The replica-set initiation command is for the newly emptied data folders; do not run it on an already-initialized set.

```bash
bash scripts/replica-up.sh
mongosh --port 27017 --eval 'rs.initiate({_id:"rs0", members:[{_id:0,host:"127.0.0.1:27017"},{_id:1,host:"127.0.0.1:27018"},{_id:2,host:"127.0.0.1:27019"}]})'
bash scripts/replica-status.sh
```

Confirm the status output shows one `PRIMARY` and two `SECONDARY` nodes, then create `.env` from the example only if you do not already have one, and seed the application:

```bash
test -f .env || cp .env.example .env
npm install
npm run seed
npm run dev
```

`replica-up.sh` recreates the data folders. Keep the replica-set initiation step for this fresh database only. `npm run seed` is safe to re-run because it upserts the initial records. After deleting the data, re-capture any evidence you still need; existing evidence and screenshots refer to the deleted database contents. Ports 27017, 27018, 27019, 1883, and 3000 must be free when starting the full application.

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
