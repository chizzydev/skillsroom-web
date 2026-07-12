# Chat Web Load Testing

This harness exercises the production chat UI through a real Chromium browser and writes repeatable performance reports to `reports/chat-web-load/`.

## Run

Use three terminals.

Terminal 1, API:

```powershell
cd C:\Users\HP\skill-rooms-api
npm run dev
```

Terminal 2, web:

```powershell
cd C:\Users\HP\skill-rooms-web
npm run dev
```

Terminal 3, fixture and browser harness:

```powershell
cd C:\Users\HP\skill-rooms-api
npm run db:seed:chat-heavy

cd C:\Users\HP\skill-rooms-web
$env:CHAT_WEB_LOAD_BASE_URL='http://localhost:3100'
$env:CHAT_WEB_LOAD_CHANNEL='chat_load_lab'
$env:CHAT_WEB_LOAD_SWITCH_CHANNEL='Global Chat'
$env:CHAT_WEB_LOAD_EMAIL='chat-load-1@skillsroom.local'
$env:CHAT_WEB_LOAD_PASSWORD='SkillsroomLoadTest!2026'
npm run chat:web-load
```

If the harness opens the sign-in page, provide either a storage state file or email/password:

```powershell
$env:CHAT_WEB_LOAD_EMAIL='you@example.com'
$env:CHAT_WEB_LOAD_PASSWORD='your-password'
npm run chat:web-load
```

The heavy chat fixture creates `chat-load-1@skillsroom.local` through `chat-load-40@skillsroom.local`. Override the seeded password with `CHAT_HEAVY_USER_PASSWORD` before running `npm run db:seed:chat-heavy` if needed.

## Output

The runner writes:

- `reports/chat-web-load/latest.json`
- `reports/chat-web-load/chat-web-load-<timestamp>.json`

Each report includes:

- initial chat load
- channel switch time
- input latency
- message append latency
- reaction latency
- search latency
- media panel open time
- thread open time
- older-message scroll/load time
- dropped-frame sample
- JS heap growth
- console errors and failed requests

When `latest.json` already exists, the next run includes before/after deltas against that previous report.
