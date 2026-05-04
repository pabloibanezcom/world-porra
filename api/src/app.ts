import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import matchRoutes from './routes/matches';
import predictionRoutes from './routes/predictions';
import leagueRoutes from './routes/leagues';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import { resolveRuntimeScenario } from './config/scenarioRuntime';
import { runWithRequestContext } from './utils/requestContext';

export const app = express();

app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  const scenario = resolveRuntimeScenario(req);
  runWithRequestContext(
    {
      scenario: scenario?.slug,
      tournamentNow: scenario?.now,
    },
    next
  );
});
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const db = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  const status = db === 'connected' ? 'ok' : 'degraded';
  const scenario = resolveRuntimeScenario(_req);
  res.status(db === 'connected' ? 200 : 503).json({
    status,
    db,
    dbName: mongoose.connection.name,
    scenario: scenario?.slug ?? null,
    tournamentNow: scenario?.now ?? null,
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRoutes);
app.use('/matches', matchRoutes);
app.use('/predictions', predictionRoutes);
app.use('/leagues', leagueRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationRoutes);

app.use(errorHandler);
