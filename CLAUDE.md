# World Porra

## What is this

Mobile app for predicting FIFA World Cup 2026 match results. Users compete in private leagues with friends.

## Tech Stack

- **Monorepo**: npm workspaces (`app/` + `api/`)
- **App**: Expo (SDK 52+), React Navigation, Zustand, Axios, TypeScript
- **API**: Express, Mongoose, JWT, Zod, TypeScript
- **Database**: MongoDB Atlas
- **Auth**: Google OAuth via `expo-auth-session` + `google-auth-library`
- **Match data**: football-data.org API
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

### Points System
| Outcome | Base Points |
|---------|-------------|
| Exact score | 10 |
| Correct GD + winner | 6 |
| Correct draw (wrong score) | 5 |
| Correct winner only | 4 |
| Wrong | 0 |

### Stage Multipliers
Group x1, R32 x1.5, R16 x2, QF x2.5, SF x3, Third Place/Final x4

### Leagues
- Private leagues with 6-char invite codes
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
