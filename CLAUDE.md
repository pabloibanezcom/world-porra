# World Porra

## What is this

Mobile app for predicting FIFA World Cup 2026 match results. Users compete in private leagues with friends.

## Tech Stack

- **Monorepo**: npm workspaces (`app/` + `api/`)
- **App**: Expo (SDK 52+), React Navigation, Zustand, Axios, TypeScript
- **API**: Express, Mongoose, JWT, Zod, TypeScript
- **Database**: MongoDB Atlas
- **Auth**: Google OAuth via `expo-auth-session` + `google-auth-library`
- **Match data**: FotMob (live/finished scores via results sync); football-data.org (initial fixture seeding only)
- **Testing**: Vitest (API)

## Structure

```
app/                  # Expo React Native app
  src/
    api/              # API client functions
    components/       # Reusable UI (MatchCard, etc.)
    screens/          # Full screens (Login, Home, MatchList, etc.)
    navigation/       # React Navigation setup
    store/            # Zustand stores (auth)
    hooks/            # Custom hooks
    types/            # Shared TypeScript types
    theme/            # Colors, spacing, typography
    utils/            # Utility functions

api/                  # Node.js Express REST API
  src/
    config/           # DB connection, env validation, logger
    middleware/       # Auth (JWT), error handler
    models/           # Mongoose: User, Match, Prediction, League
    routes/           # REST: auth, matches, predictions, leagues
    services/         # Scoring, footballApi, syncService
    jobs/             # Cron sync, seed script
  tests/              # Vitest tests
```

## Commands

```bash
# API
cd api
npm run dev              # Start dev server (tsx watch)
npm run build            # Compile TypeScript
npm run test             # Run vitest
npm run seed             # Seed matches from football-data.org

# App
cd app
npx expo start           # Start Expo dev server
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
```

## Game Mechanics

### Points System (odds-based)

Scoring is odds-based, not a fixed table — see `api/src/services/scoring.ts`.

**Group stage**
- Wrong outcome (winner/draw) → `0`
- Correct outcome → `round(chosenOdds × 2)` (fallback `2` if no odds), where `chosenOdds` is the odds of the predicted outcome (home/draw/away)
- Exact score adds a `+5` bonus
- Total capped at `20`

**Knockout stage** = `advancingPts + exactBonus`
- `advancingPts` = `round(advancingOdds × roundMultiplier)` if the predicted qualifier matches the actual winner, else `0`
- `exactBonus` = fixed per-round bonus if the exact score is correct, else `0`

| Stage | Round multiplier | Exact bonus |
|-------|------------------|-------------|
| R32 | 2 | 6 |
| R16 | 3 | 8 |
| QF | 4 | 10 |
| SF | 5 | 12 |
| Third Place | 4 | 10 |
| Final | 6 | 15 |

> Note: because outcome points scale with odds, an exact prediction is rarely worth exactly "+10" — match-result badges show the actual points earned.

### Leagues
- Private leagues with 8-character invite codes
- Max 50 members per league
- Predictions locked server-side after kickoff
- `scoresProcessed` flag prevents double-scoring

## API Endpoints

- `POST /auth/google` — Exchange Google ID token for app JWT
- `GET /auth/me` — Current user profile
- `GET /matches` — List matches (filter by stage, group, status)
- `GET /matches/:id` — Match detail with user's prediction
- `POST /predictions` — Create/update prediction (before kickoff)
- `GET /predictions/mine` — User's predictions
- `GET /predictions/match/:matchId` — League predictions (visible after kickoff)
- `POST /leagues` — Create league
- `POST /leagues/join` — Join with invite code
- `GET /leagues` — User's leagues
- `GET /leagues/:id` — League detail with leaderboard
- `DELETE /leagues/:id/leave` — Leave league

## Environment Variables

See `.env.example` for required variables:
- `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`
- `FOOTBALL_DATA_API_KEY`, `SYNC_API_KEY`
- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`

## Conventions

- No AI/Claude references in commits
- Scoring logic is server-side only (api/src/services/scoring.ts)
- Cron syncs results every 5 min during tournament, daily otherwise
