# CMP6207 report context

Student: Shekhar Lamichhane  
Module: CMP6207, Modern Data Stores  
System: household automations on MongoDB replica set `rs0`  
Target: about 4,000 words, plus screenshots in `evidence/`

This file is the writing brief. The started report is `report.tex`. The talk is `slides.pptx`. Compile the PDF with:

```bash
cd report
pdflatex report.tex
pdflatex report.tex
```

## What the submission is

One Node.js process serves three automations for home `home_001`. Sensors are simulated. Readings arrive on MQTT. The API validates each reading, stores it, updates the latest value, and runs rules. Commands go back on MQTT. The status page and Telegram only talk to the API.

| Database | Subsystem | What it does |
| --- | --- | --- |
| `smart_water` | `tank_roof_01` | 1000 L roof tank. Warn at 90% with the pump on. Pump off at 98%. Dry-run, pump failure, abnormal flow, low tank at 15%. |
| `smart_focus` | `focus_desk_01` | Desk presence. Lamp to 6500 K at 100% when someone sits. Lamp off when the desk is empty. |
| `smart_climate` | `climate_living_01` | Room temperature. Cooling starts above 28°C and stops at 26°C. |

All three databases sit on the same replica set `rs0` (ports 27017, 27018, 27019). Do not run `rs.initiate` again. Telemetry and `device_latest` use write concern `w: 1`. Incidents use `w: "majority"`. The rule engine reads from the primary.

`smart_water` also keeps the `tanks` collection. Water documents still carry `tank_id` so `/api/tanks` works. Every automation document carries `subsystem_id`.

## Locked facts for the report

- Topic shape: `ioThings/{home_id}/{subsystem_id}/{device_type}/{device_id}/telemetry`
- Commands: the same path ending in `/command`, QoS 1
- Water devices: `tank_level`, `water_flow`, `motor_state`, `source_presence`
- Desk devices: `desk_presence`, `ambient_light`, `desk_lamp`
- Climate devices: `room_temperature`, `hvac`
- Litres in the tank are calculated on read from capacity and `level_pct`. They are not their own sensor message.
- Litres saved on an overflow cutoff is `flow_rate_lpm × 20`. The overflow scenario uses 15 L/min, so the recorded save is 300 L.
- A multi-sensor rule runs only when the readings it needs were updated together.
- The engine skips a rule when an open incident already exists for that `rule_id`.
- Telegram is sent only when `TELEGRAM_BOT_TOKEN` is the full BotFather token and `TELEGRAM_CHAT_ID` is the person's own chat id. The API must be restarted after `.env` changes.
- Left out on purpose: a phone app, real hardware, a pet feeder, humidity, turbidity, TDS, pump schedules, and starting the pump when the tank is low.

## Suggested word budget

| Section | Words | Job |
| --- | --- | --- |
| Introduction | 400 | Household problem, why a document store, what was built |
| NoSQL appraisal | 700 | Document model, flexible readings, comparison with a relational schema |
| Architecture | 500 | MQTT, API, rule engine, three databases, status page |
| Replica set | 600 | `rs0`, primary and secondaries, write concern, what failover would show |
| Data model and rules | 700 | Collections, water rules, desk rules, climate rules |
| Implementation and demonstration | 700 | Seed, scenarios, notifications, what was observed |
| Evaluation and conclusion | 400 | What the design is good at, what is still simulated |
| Total | 4000 | |

## Evidence still to capture

Save these under `evidence/` before the final PDF. The current draft marks them as still to record. Do not invent the numbers.

- `rs.status()` showing one primary and two secondaries
- One document from each collection in each database
- Overflow: warning, then pump off at 98%
- Dry-run, pump failure, abnormal flow, and `confirmed_fault` after 30 seconds
- `study` and `cool` each producing one notification
- A notification line that says it was sent on Telegram
- Failover: stop the primary during an overflow, record the election, show the cutoff incident still stored, then restart the node

## How to demonstrate while writing

From the project root, with the replica set already up:

```bash
npm run seed
npm run dev
```

In another terminal, one case at a time:

```bash
npm run simulate -- overflow
npm run simulate -- study
npm run simulate -- cool
```

`cool` is the living room only. The tank and the desk stay on their last stored readings until their own simulators run. Stop `cool` with Ctrl+C so it does not repeat cooling alerts.

## Tone

Write in plain sentences. Name the collection, the threshold, and the outcome. Do not describe the status page as a commercial product, and do not copy names or pictures from the design references used while building the UI.
