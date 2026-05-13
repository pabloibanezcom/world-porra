# World Porra

A mobile-first app for predicting FIFA World Cup 2026 match results. Compete in private leagues with friends and track your accuracy across the tournament.

## Features

- **Match predictions** — submit score predictions before kickoff; locked server-side once the match starts
- **Points system** — earn points for exact scores, correct goal differences, or correct winners, with stage multipliers
- **Private leagues** — create leagues, invite friends with an 8-character code, and track a live leaderboard
- **Google auth** — sign in with Google; dev login available for local testing

## Points System

| Result | Points |
|---|---|
| Exact score | 10 |
| Correct goal difference + winner | 6 |
| Correct draw (wrong score) | 5 |
| Correct winner only | 4 |
| Wrong | 0 |

Stage multipliers: Group ×1 · R32 ×1.5 · R16 ×2 · QF ×2.5 · SF ×3 · Final ×4

## Tech Stack

| | |
|---|---|
| **App** | Expo (SDK 52), React Navigation, Zustand, TypeScript |
| **API** | Node.js, Express, Mongoose, Zod, JWT |
| **Database** | MongoDB Atlas |
| **Auth** | Google OAuth via `expo-auth-session` |
| **Match data** | football-data.org API |

## Project Structure

```
app/          # Expo React Native app (targets iOS, Android, PWA)
api/          # Node.js REST API
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)
- Google OAuth client ID
- football-data.org API key

### Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```
MONGODB_URI=
JWT_SECRET=
GOOGLE_CLIENT_ID=
FOOTBALL_DATA_API_KEY=
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Use the Google Web client ID for both `GOOGLE_CLIENT_ID` on the API and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the app.

Optional poll deadline defaults:

```
POLL_PICKS_DEADLINE=
POLL_GROUP_PREDICTIONS_DEADLINE=
POLL_TOURNAMENT_PREDICTIONS_DEADLINE=
```

Use `POLL_PICKS_DEADLINE` when group standings and tournament picks share one deadline. Use the more specific variables when they need separate defaults. Master users can override these values through the global poll config stored in MongoDB.

3. Seed match data:

```bash
cd api && npm run seed
```

### Tournament Scenario Databases

To test different tournament phases, clone your configured test database into deterministic scenario databases:

```bash
npm run seed:scenario -- all
```

Or create only the scenario you need:

```bash
npm run seed:scenario -- group-mid
```

Available scenarios are:

```
pre-tournament
eve
group-mid
group-late
knockout-r32
knockout-r16
final-eve
complete
```

Each scenario is written to a suffixed database such as `wc2026_test_group_mid`. The command prints the `MONGODB_URI` and `TOURNAMENT_NOW` values to use when running the API against that phase. In non-production environments, `TOURNAMENT_NOW` overrides the app's server-side clock for prediction locks and post-kickoff prediction visibility.

To start the API against one of those scenario databases without editing `api/.env`, run:

```bash
npm run api:scenario -- group-mid
```

This derives the scenario database name from your configured `MONGODB_URI` and applies the matching `TOURNAMENT_NOW` for that process only.

For a deployed Vercel API that can serve every scenario from one URL, enable the scenario switcher in the API environment:

```env
ENABLE_SCENARIO_SWITCHER=true
SCENARIO_BASE_MONGODB_URI=mongodb+srv://.../test?appName=Cluster0
```

`SCENARIO_BASE_MONGODB_URI` is optional; when omitted, the API derives scenario databases from `MONGODB_URI`. For example, a base DB of `test` maps `group-mid` to `test_group_mid`.

Then start the mobile app against the deployed API and choose a phase:

```bash
npm run app:vercel:scenario -- group-mid
```

The app keeps using the Vercel API URL and sends `X-WC-Scenario` with each request. You can also hit the API directly with `?scenario=group-mid`, for example:

```bash
https://world-porra-api.vercel.app/health?scenario=group-mid
```

If your current network cannot connect to Atlas, deploy the API and seed the scenario databases from Vercel instead:

```bash
curl -X POST https://world-porra-api.vercel.app/admin/scenarios/seed \
  -H "x-sync-api-key: $SYNC_API_KEY" \
  -H "content-type: application/json" \
  -d '{"scenarios":["group-mid"]}'
```

To seed every scenario from Vercel:

```bash
curl -X POST https://world-porra-api.vercel.app/admin/scenarios/seed \
  -H "x-sync-api-key: $SYNC_API_KEY" \
  -H "content-type: application/json" \
  -d '{"scenarios":"all"}'
```

If Vercel times out while creating all databases, run one scenario at a time. This endpoint uses the same `SYNC_API_KEY` protection as `/admin/sync`.

### Running

From the repo root:

```bash
npm run dev       # API + app concurrently
npm run api       # API only (http://localhost:3000)
npm run app       # Expo app only
npm run app:mobile # Expo on LAN for a physical device
npm run app:vercel # Expo on LAN using the hosted Vercel API
```

Or individually:

```bash
# API
cd api && npm run dev

# App
cd app && npx expo start
```

### Using a Physical Phone

By default, the local Expo app uses the hosted Vercel API. To run Expo Go on a phone against a local API instead:

- Start the API locally with `npm run api`
- Start Expo on LAN with `npm run app:mobile`
- Keep your phone and computer on the same Wi-Fi network
- Set `EXPO_PUBLIC_API_URL` to your computer's LAN address, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000
```

To make the hosted API explicit while starting on LAN, use:

```bash
npm run app:vercel
```

This starts Expo on LAN with `EXPO_PUBLIC_API_PRESET=vercel`, which takes precedence over the local `EXPO_PUBLIC_API_URL` in `app/.env`.

## API

See [`api/wc2026.postman_collection.json`](api/wc2026.postman_collection.json) for a Postman collection with all endpoints. Hit **Dev Login** first — it auto-saves the token for all subsequent requests.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/google` | Exchange Google ID token for app JWT |
| POST | `/auth/dev` | Dev login (non-production only) |
| GET | `/auth/me` | Current user profile |
| GET | `/matches` | List matches (filter by stage, group, status) |
| GET | `/matches/:id` | Match detail with user's prediction |
| POST | `/predictions` | Create or update a prediction |
| GET | `/predictions/mine` | User's predictions |
| GET | `/predictions/match/:matchId` | Predictions for a match (post-kickoff) |
| POST | `/leagues` | Create a league |
| POST | `/leagues/join` | Join a league by invite code |
| GET | `/leagues` | User's leagues |
| GET | `/leagues/:id` | League detail with leaderboard |
| DELETE | `/leagues/:id/leave` | Leave a league |
