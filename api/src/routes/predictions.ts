import { Router, Response } from 'express';
import { z } from 'zod';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { GroupPrediction } from '../models/GroupPrediction';
import { TournamentPrediction } from '../models/TournamentPrediction';
import { League } from '../models/League';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { MatchWinner } from '../models/Match';
import {
  ApiLanguage,
  getMatchTeamCodes,
  getRequestLanguage,
  hydrateTeamCodes,
  localizeTeam,
  getTeamCatalog,
} from '../services/countryTeamService';
import { currentDate } from '../utils/time';

const router = Router();

const LOCK_MINUTES_BEFORE = 15;

const predictionSchema = z.object({
  matchId: z.string().min(1),
  homeGoals: z.number().int().min(0).max(15),
  awayGoals: z.number().int().min(0).max(15),
  qualifier: z.enum(['HOME', 'AWAY']).nullable().optional(),
});

const groupPredictionSchema = z.object({
  group: z.string().min(1).max(8),
  orderedTeamCodes: z.array(z.string().min(1)).min(2).max(6).optional(),
  orderedTeams: z.array(z.object({
    code: z.string().min(1),
  })).min(2).max(6).optional(),
});

function deriveWinner(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isTeamCodeTbd(code: string): boolean {
  return normalizeCode(code) === 'TBD';
}

async function serializeGroupPrediction<T extends { _id: unknown; userId: unknown; orderedTeamCodes?: string[]; orderedTeams?: Array<{ code: string }> }>(
  prediction: T,
  language: ApiLanguage = 'en',
) {
  const orderedTeamCodes = prediction.orderedTeamCodes?.length
    ? prediction.orderedTeamCodes
    : prediction.orderedTeams?.map((team) => team.code) ?? [];

  return {
    ...prediction,
    _id: String(prediction._id),
    userId: String(prediction.userId),
    orderedTeamCodes,
    orderedTeams: await hydrateTeamCodes(orderedTeamCodes, language),
  };
}

function serializePrediction<T extends { _id: unknown; userId: unknown; matchId: unknown }>(prediction: T) {
  return {
    ...prediction,
    _id: String(prediction._id),
    userId: String(prediction.userId),
    matchId: String(prediction.matchId),
  };
}

const KNOCKOUT_STAGES = new Set(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']);

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { matchId, homeGoals, awayGoals, qualifier } = predictionSchema.parse(req.body);

    const match = await Match.findById(matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    const { homeTeamCode, awayTeamCode } = getMatchTeamCodes(match);
    if (isTeamCodeTbd(homeTeamCode) || isTeamCodeTbd(awayTeamCode)) {
      res.status(400).json({ error: 'Predictions are not available until both teams are confirmed.' });
      return;
    }

    const lockTime = new Date(match.utcDate.getTime() - LOCK_MINUTES_BEFORE * 60 * 1000);
    if (currentDate() >= lockTime) {
      res.status(400).json({ error: 'Predictions are locked 15 minutes before kickoff.' });
      return;
    }

    const isKnockout = KNOCKOUT_STAGES.has(match.stage);

    if (isKnockout) {
      // Qualifier must be provided for knockout matches
      if (!qualifier) {
        res.status(400).json({ error: 'Knockout predictions require a qualifier (HOME or AWAY).' });
        return;
      }
      // Qualifier must be consistent with predicted score (can't pick away if score shows home winning)
      const predictedOutcome = deriveWinner(homeGoals, awayGoals);
      if (predictedOutcome === 'HOME' && qualifier !== 'HOME') {
        res.status(400).json({ error: 'Qualifier must match the predicted winner when the score is not a draw.' });
        return;
      }
      if (predictedOutcome === 'AWAY' && qualifier !== 'AWAY') {
        res.status(400).json({ error: 'Qualifier must match the predicted winner when the score is not a draw.' });
        return;
      }
    }

    const predictedWinner = deriveWinner(homeGoals, awayGoals);

    const prediction = await Prediction.findOneAndUpdate(
      { userId: req.userId, matchId },
      { homeGoals, awayGoals, predictedWinner, qualifier: isKnockout ? qualifier : null, points: null },
      { upsert: true, new: true }
    );

    res.json({ prediction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid prediction data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/groups/mine', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const predictions = await GroupPrediction.find({ userId: req.userId })
    .sort({ group: 1 })
    .lean();

  const language = getRequestLanguage(req);
  res.json({ predictions: await Promise.all(predictions.map((prediction) => serializeGroupPrediction(prediction, language))) });
});

router.post('/groups', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { group, orderedTeamCodes, orderedTeams } = groupPredictionSchema.parse(req.body);
    const normalizedGroup = group.trim().toUpperCase();
    const normalizedTeamCodes = (orderedTeamCodes ?? orderedTeams?.map((team) => team.code) ?? []).map(normalizeCode);

    if (normalizedTeamCodes.length < 2) {
      res.status(400).json({ error: 'At least two teams are required.' });
      return;
    }

    if (normalizedTeamCodes.some(isTeamCodeTbd)) {
      res.status(400).json({ error: 'Group predictions are not available until all teams are confirmed.' });
      return;
    }

    const uniqueCodes = new Set(normalizedTeamCodes);
    if (uniqueCodes.size !== normalizedTeamCodes.length) {
      res.status(400).json({ error: 'Each team can only appear once in a group prediction.' });
      return;
    }

    const groupMatches = await Match.find({ stage: 'GROUP', group: normalizedGroup }).lean();
    if (groupMatches.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (groupMatches.some((match) => currentDate() >= match.utcDate)) {
      res.status(400).json({ error: 'This group has already started. Predictions are locked.' });
      return;
    }

    const knownTeamCodes = new Set<string>();
    for (const match of groupMatches) {
      const { homeTeamCode, awayTeamCode } = getMatchTeamCodes(match);
      if (!isTeamCodeTbd(homeTeamCode)) knownTeamCodes.add(homeTeamCode);
      if (!isTeamCodeTbd(awayTeamCode)) knownTeamCodes.add(awayTeamCode);
    }

    if (
      knownTeamCodes.size !== normalizedTeamCodes.length ||
      normalizedTeamCodes.some((code) => !knownTeamCodes.has(code))
    ) {
      res.status(400).json({ error: 'Group prediction must include all confirmed teams in this group.' });
      return;
    }

    const prediction = await GroupPrediction.findOneAndUpdate(
      { userId: req.userId, group: normalizedGroup },
      { group: normalizedGroup, orderedTeamCodes: normalizedTeamCodes, points: null },
      { upsert: true, new: true }
    );

    res.json({ prediction: await serializeGroupPrediction(prediction.toObject(), getRequestLanguage(req)) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid group prediction data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { stage } = req.query;

  const filter: Record<string, unknown> = { userId: req.userId };

  if (typeof stage === 'string' && stage) {
    const stageMatches = await Match.find({ stage }).select('_id').lean();
    filter.matchId = { $in: stageMatches.map((match) => match._id) };
  }

  const predictions = await Prediction.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ predictions: predictions.map(serializePrediction) });
});

router.get('/match/:matchId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const match = await Match.findById(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  // Only show others' predictions after kickoff
  if (currentDate() < match.utcDate) {
    const own = await Prediction.findOne({ userId: req.userId, matchId: match._id }).lean();
    res.json({ predictions: own ? [own] : [] });
    return;
  }

  const { leagueId } = req.query;
  const filter: Record<string, unknown> = { matchId: match._id };

  if (leagueId) {
    const league = await League.findById(leagueId);
    if (league) {
      const memberIds = league.members.map((m) => m.userId);
      filter.userId = { $in: memberIds };
    }
  }

  const predictions = await Prediction.find(filter).populate('userId', 'name avatarUrl').lean();
  res.json({ predictions });
});

const teamPickSchema = z.object({ name: z.string().min(1).optional(), code: z.string().min(1) }).optional();
const playerPickSchema = z
  .object({ name: z.string().min(1), team: z.string().min(1), code: z.string().min(1), pos: z.string().min(1) })
  .optional();

const tournamentPredictionSchema = z.object({
  champion: teamPickSchema,
  runnerUp: teamPickSchema,
  semi1: teamPickSchema,
  semi2: teamPickSchema,
  bestPlayer: playerPickSchema,
  topScorer: playerPickSchema,
  bestYoung: playerPickSchema,
});

const TEAM_PICK_FIELDS = [
  ['champion', 'championCode'],
  ['runnerUp', 'runnerUpCode'],
  ['semi1', 'semi1Code'],
  ['semi2', 'semi2Code'],
] as const;

async function serializeTournamentPrediction<T extends Record<string, any>>(prediction: T | null, language: ReturnType<typeof getRequestLanguage>) {
  if (!prediction) return null;

  const codes = TEAM_PICK_FIELDS
    .map(([pickField, codeField]) => prediction[codeField] ?? prediction[pickField]?.code)
    .filter(Boolean)
    .map(normalizeCode);
  const catalog = await getTeamCatalog(codes);
  const serialized: Record<string, unknown> = { ...prediction };

  TEAM_PICK_FIELDS.forEach(([pickField, codeField]) => {
    const code = prediction[codeField] ?? prediction[pickField]?.code;
    if (code) {
      const normalizedCode = normalizeCode(code);
      serialized[codeField] = normalizedCode;
      serialized[pickField] = localizeTeam(catalog.get(normalizedCode), normalizedCode, language);
    }
  });

  return serialized;
}

router.get('/tournament', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const doc = await TournamentPrediction.findOne({ userId: req.userId }).lean();
  res.json({ prediction: await serializeTournamentPrediction(doc, getRequestLanguage(req)) });
});

router.post('/tournament', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = tournamentPredictionSchema.parse(req.body);
    const update = TEAM_PICK_FIELDS.reduce<Record<string, string | undefined>>((acc, [pickField, codeField]) => {
      acc[codeField] = data[pickField]?.code ? normalizeCode(data[pickField].code) : undefined;
      return acc;
    }, {});

    const doc = await TournamentPrediction.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          ...update,
          bestPlayer: data.bestPlayer,
          topScorer: data.topScorer,
          bestYoung: data.bestYoung,
        },
      },
      { upsert: true, new: true }
    ).lean();
    res.json({ prediction: await serializeTournamentPrediction(doc, getRequestLanguage(req)) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
