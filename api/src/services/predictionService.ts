import {
  groupPredictionInputSchema,
  matchPredictionInputSchema,
  tournamentPicksSchema,
} from '../shared';
import type {
  GroupPredictionInput,
  MatchPredictionInput,
  TournamentPredictionInput,
} from '../shared';
import { GroupPrediction } from '../models/GroupPrediction';
import { League } from '../models/League';
import { Match } from '../models/Match';
import type { MatchWinner } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { TournamentPrediction } from '../models/TournamentPrediction';
import {
  ApiLanguage,
  getMatchTeamCodes,
  getTeamCatalog,
  getTournamentParticipantCodes,
  hydrateTeamCodes,
  localizeTeam,
} from './countryTeamService';
import { isGroupPredictionsLocked, isTournamentPredictionsLocked } from './pollConfigService';
import { currentDate } from '../utils/time';

const LOCK_MINUTES_BEFORE = 5;
const BEST_YOUNG_MAX_AGE = 21;

const KNOCKOUT_STAGES = new Set(['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']);
const GROUP_POSITION_POINTS = [8, 6, 3, 3];

export const predictionSchema = matchPredictionInputSchema;
export const groupPredictionSchema = groupPredictionInputSchema;
export const tournamentPredictionSchema = tournamentPicksSchema;

const TEAM_PICK_FIELDS = [
  ['champion', 'championCode'],
  ['runnerUp', 'runnerUpCode'],
  ['semi1', 'semi1Code'],
  ['semi2', 'semi2Code'],
] as const;

interface GroupTableRow {
  code: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export class PredictionServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function deriveWinner(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return normalized === 'CUR' ? 'CUW' : normalized;
}

function isTeamCodeTbd(code: string): boolean {
  return normalizeCode(code) === 'TBD';
}

function emptyGroupRow(code: string): GroupTableRow {
  return {
    code,
    played: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

function applyResult(row: GroupTableRow, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) row.points += 3;
  else if (goalsFor === goalsAgainst) row.points += 1;
}

async function getCurrentGroupTable(group: string): Promise<GroupTableRow[]> {
  const matches = await Match.find({ stage: 'GROUP', group }).sort({ utcDate: 1 }).lean();
  const table = new Map<string, GroupTableRow>();

  matches.forEach((match) => {
    const { homeTeamCode, awayTeamCode } = getMatchTeamCodes(match);
    if (!isTeamCodeTbd(homeTeamCode)) table.set(homeTeamCode, table.get(homeTeamCode) ?? emptyGroupRow(homeTeamCode));
    if (!isTeamCodeTbd(awayTeamCode)) table.set(awayTeamCode, table.get(awayTeamCode) ?? emptyGroupRow(awayTeamCode));

    if (match.status !== 'FINISHED' || !match.result || isTeamCodeTbd(homeTeamCode) || isTeamCodeTbd(awayTeamCode)) {
      return;
    }

    applyResult(table.get(homeTeamCode)!, match.result.homeGoals, match.result.awayGoals);
    applyResult(table.get(awayTeamCode)!, match.result.awayGoals, match.result.homeGoals);
  });

  return Array.from(table.values()).sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.code.localeCompare(b.code)
  );
}

function calculateGroupPredictionProgress(predictedCodes: string[], currentCodes: string[]) {
  const currentPositionByCode = new Map(currentCodes.map((code, index) => [code, index]));
  let projectedPoints = 0;

  const teams = predictedCodes.map((code, predictedIndex) => {
    const currentIndex = currentPositionByCode.get(code);
    let points = 0;
    let status: 'exact' | 'qualified' | 'miss' | 'pending' = 'pending';

    if (currentIndex !== undefined) {
      if (currentIndex === predictedIndex) {
        points = GROUP_POSITION_POINTS[predictedIndex] ?? 0;
        status = 'exact';
      } else if (predictedIndex < 3 && currentIndex < 3) {
        points = 2;
        status = 'qualified';
      } else {
        status = 'miss';
      }
    }

    projectedPoints += points;

    return {
      code,
      predictedPosition: predictedIndex + 1,
      currentPosition: currentIndex === undefined ? null : currentIndex + 1,
      points,
      status,
    };
  });

  const isPerfect = predictedCodes.length > 0 &&
    predictedCodes.every((code, index) => currentCodes[index] === code);

  if (isPerfect) projectedPoints += 5;

  return {
    projectedPoints,
    perfectBonus: isPerfect ? 5 : 0,
    currentOrderCodes: currentCodes,
    teams,
  };
}

async function getGroupPredictionProgress(orderedTeamCodes: string[], language: ApiLanguage) {
  const normalizedCodes = orderedTeamCodes.map(normalizeCode);
  const firstCode = normalizedCodes[0];
  if (!firstCode) return null;

  const match = await Match.findOne({
    stage: 'GROUP',
    $or: [{ homeTeamCode: firstCode }, { awayTeamCode: firstCode }],
  }).lean();
  if (!match?.group) return null;

  const table = await getCurrentGroupTable(match.group);
  const hasStarted = table.some((row) => row.played > 0);
  if (!hasStarted) {
    return {
      projectedPoints: 0,
      perfectBonus: 0,
      currentOrderCodes: [],
      teams: normalizedCodes.map((code, index) => ({
        code,
        predictedPosition: index + 1,
        currentPosition: null,
        points: 0,
        status: 'pending' as const,
      })),
      currentOrder: [],
    };
  }

  const currentOrderCodes = table.map((row) => row.code);
  const progress = calculateGroupPredictionProgress(normalizedCodes, currentOrderCodes);
  const hydratedCurrentOrder = await hydrateTeamCodes(currentOrderCodes, language);

  return {
    ...progress,
    currentOrder: hydratedCurrentOrder.map((team, index) => ({
      ...team,
      position: index + 1,
      played: table[index]?.played ?? 0,
      points: table[index]?.points ?? 0,
      goalDifference: table[index]?.goalDifference ?? 0,
    })),
  };
}

export async function serializeGroupPrediction<T extends { _id: unknown; userId: unknown; orderedTeamCodes?: string[]; orderedTeams?: Array<{ code: string }> }>(
  prediction: T,
  language: ApiLanguage = 'en',
) {
  const orderedTeamCodes = prediction.orderedTeamCodes?.length
    ? prediction.orderedTeamCodes
    : prediction.orderedTeams?.map((team) => team.code) ?? [];

  const progress = await getGroupPredictionProgress(orderedTeamCodes, language);

  return {
    ...prediction,
    _id: String(prediction._id),
    userId: String(prediction.userId),
    orderedTeamCodes,
    orderedTeams: await hydrateTeamCodes(orderedTeamCodes, language),
    progress,
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

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

async function validateTournamentPredictionCatalog(data: TournamentPredictionInput): Promise<string | null> {
  const teamCodes = TEAM_PICK_FIELDS
    .map(([pickField]) => data[pickField]?.code)
    .filter((code): code is string => !!code)
    .map(normalizeCode);
  const duplicateTeamCode = teamCodes.find((code, index) => teamCodes.indexOf(code) !== index);
  if (duplicateTeamCode) return `Tournament final four picks must be unique (${duplicateTeamCode})`;

  const playerPicks = [data.bestPlayer, data.topScorer, data.bestYoung]
    .filter((player): player is NonNullable<typeof player> => !!player);
  const playerCodes = playerPicks.map((player) => normalizeCode(player.code));
  const [catalog, participantCodes] = await Promise.all([
    getTeamCatalog([...teamCodes, ...playerCodes]),
    getTournamentParticipantCodes(),
  ]);
  const participantCodeSet = new Set(participantCodes);

  const missingTeamCode = teamCodes.find((code) => !catalog.has(code) || !participantCodeSet.has(code));
  if (missingTeamCode) return `Unknown tournament team "${missingTeamCode}"`;

  const nonParticipantPlayerCode = playerCodes.find((code) => !participantCodeSet.has(code));
  if (nonParticipantPlayerCode) return `Unknown tournament team "${nonParticipantPlayerCode}"`;

  const invalidPlayer = playerPicks.find((player) => {
    const team = catalog.get(normalizeCode(player.code));
    const players = team?.players ?? [];
    return !players.some((catalogPlayer) => (
      normalizePlayerName(catalogPlayer.name) === normalizePlayerName(player.name)
      && catalogPlayer.pos === player.pos
      && catalogPlayer.age === player.age
      && (player.shirtNumber == null || catalogPlayer.shirtNumber === player.shirtNumber)
    ));
  });
  if (invalidPlayer) return `Unknown tournament player "${invalidPlayer.name}"`;

  if (data.bestYoung && data.bestYoung.age > BEST_YOUNG_MAX_AGE) {
    return `Best young player must be ${BEST_YOUNG_MAX_AGE} or younger`;
  }

  return null;
}

export async function serializeTournamentPrediction<T extends Record<string, any>>(prediction: T | null, language: ApiLanguage) {
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

export async function saveMatchPrediction(userId: string, input: MatchPredictionInput) {
  const { matchId, homeGoals, awayGoals, qualifier } = input;

  const match = await Match.findById(matchId);
  if (!match) {
    throw new PredictionServiceError(404, 'Match not found');
  }

  const { homeTeamCode, awayTeamCode } = getMatchTeamCodes(match);
  if (isTeamCodeTbd(homeTeamCode) || isTeamCodeTbd(awayTeamCode)) {
    throw new PredictionServiceError(400, 'Predictions are not available until both teams are confirmed.');
  }

  if (match.status !== 'SCHEDULED') {
    throw new PredictionServiceError(400, 'Predictions are locked for this match.');
  }

  const lockTime = new Date(match.utcDate.getTime() - LOCK_MINUTES_BEFORE * 60 * 1000);
  if (currentDate() >= lockTime) {
    throw new PredictionServiceError(400, 'Predictions are locked 5 minutes before kickoff.');
  }

  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const predictedWinner = deriveWinner(homeGoals, awayGoals);

  if (isKnockout) {
    if (!qualifier) {
      throw new PredictionServiceError(400, 'Knockout predictions require a qualifier (HOME or AWAY).');
    }
    if (predictedWinner === 'HOME' && qualifier !== 'HOME') {
      throw new PredictionServiceError(400, 'Qualifier must match the predicted winner when the score is not a draw.');
    }
    if (predictedWinner === 'AWAY' && qualifier !== 'AWAY') {
      throw new PredictionServiceError(400, 'Qualifier must match the predicted winner when the score is not a draw.');
    }
  }

  return Prediction.findOneAndUpdate(
    { userId, matchId },
    { homeGoals, awayGoals, predictedWinner, qualifier: isKnockout ? qualifier : null, points: null },
    { upsert: true, new: true }
  );
}

// Jokers are tracked per stage category: one for the group stage (matches 1–72)
// and one for the knockout stage (matches 73–104).
type JokerCategory = 'GROUP' | 'KNOCKOUT';

function getJokerCategory(stage: string): JokerCategory {
  return KNOCKOUT_STAGES.has(stage) ? 'KNOCKOUT' : 'GROUP';
}

export async function setMatchJoker(userId: string, matchId: string, active: boolean) {
  const match = await Match.findById(matchId);
  if (!match) {
    throw new PredictionServiceError(404, 'Match not found');
  }

  if (match.status !== 'SCHEDULED') {
    throw new PredictionServiceError(400, 'Predictions are locked for this match.');
  }

  const lockTime = new Date(match.utcDate.getTime() - LOCK_MINUTES_BEFORE * 60 * 1000);
  if (currentDate() >= lockTime) {
    throw new PredictionServiceError(400, 'Predictions are locked 5 minutes before kickoff.');
  }

  const prediction = await Prediction.findOne({ userId, matchId });
  if (!prediction) {
    throw new PredictionServiceError(400, 'Save your prediction before playing a joker.');
  }

  if (active) {
    const category = getJokerCategory(match.stage);

    // Find every other match this user has already jokered in the same category.
    const jokeredPredictions = await Prediction.find({
      userId,
      joker: true,
      matchId: { $ne: prediction.matchId },
    }).lean();

    if (jokeredPredictions.length > 0) {
      const otherMatchIds = jokeredPredictions.map((item) => item.matchId);
      const otherMatches = await Match.find({ _id: { $in: otherMatchIds } }).select('stage').lean();
      const alreadyUsedInCategory = otherMatches.some((item) => getJokerCategory(item.stage) === category);
      if (alreadyUsedInCategory) {
        throw new PredictionServiceError(400, 'You have already played your joker in this stage.');
      }
    }
  }

  prediction.joker = active;
  prediction.points = null;
  await prediction.save();

  return serializePrediction(prediction.toObject());
}

export async function getMyGroupPredictions(userId: string, language: ApiLanguage) {
  const predictions = await GroupPrediction.find({ userId })
    .sort({ group: 1 })
    .lean();

  return Promise.all(predictions.map((prediction) => serializeGroupPrediction(prediction, language)));
}

export async function saveGroupPrediction(userId: string, input: GroupPredictionInput, language: ApiLanguage) {
  const normalizedGroup = input.group.trim().toUpperCase();
  const normalizedTeamCodes = (input.orderedTeamCodes ?? input.orderedTeams?.map((team) => team.code) ?? []).map(normalizeCode);

  if (normalizedTeamCodes.length < 2) {
    throw new PredictionServiceError(400, 'At least two teams are required.');
  }

  if (normalizedTeamCodes.some(isTeamCodeTbd)) {
    throw new PredictionServiceError(400, 'Group predictions are not available until all teams are confirmed.');
  }

  const uniqueCodes = new Set(normalizedTeamCodes);
  if (uniqueCodes.size !== normalizedTeamCodes.length) {
    throw new PredictionServiceError(400, 'Each team can only appear once in a group prediction.');
  }

  const groupMatches = await Match.find({ stage: 'GROUP', group: normalizedGroup }).lean();
  if (groupMatches.length === 0) {
    throw new PredictionServiceError(404, 'Group not found');
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
    throw new PredictionServiceError(400, 'Group prediction must include all confirmed teams in this group.');
  }

  if (await isGroupPredictionsLocked()) {
    throw new PredictionServiceError(400, 'Group predictions are locked.');
  }

  const prediction = await GroupPrediction.findOneAndUpdate(
    { userId, group: normalizedGroup },
    { group: normalizedGroup, orderedTeamCodes: normalizedTeamCodes, points: null },
    { upsert: true, new: true }
  );

  return serializeGroupPrediction(prediction.toObject(), language);
}

export async function getMyPredictions(userId: string, stage?: string) {
  const filter: Record<string, unknown> = { userId };

  if (stage) {
    const stageMatches = await Match.find({ stage }).select('_id').lean();
    filter.matchId = { $in: stageMatches.map((match) => match._id) };
  }

  const predictions = await Prediction.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return predictions.map(serializePrediction);
}

export async function getMatchPredictionsForViewer(userId: string, matchId: string, leagueId?: string) {
  const match = await Match.findById(matchId);
  if (!match) {
    throw new PredictionServiceError(404, 'Match not found');
  }

  if (currentDate() < match.utcDate) {
    const own = await Prediction.findOne({ userId, matchId: match._id }).lean();
    return own ? [own] : [];
  }

  const filter: Record<string, unknown> = { matchId: match._id };

  if (leagueId) {
    const league = await League.findById(leagueId);
    if (!league) {
      throw new PredictionServiceError(404, 'League not found');
    }

    const memberIds = league.members.map((member) => member.userId);
    const viewerIsMember = memberIds.some((memberId) => memberId.toString() === userId);
    if (!viewerIsMember) {
      throw new PredictionServiceError(403, 'You are not a member of this league.');
    }

    filter.userId = { $in: memberIds };
  }

  return Prediction.find(filter).populate('userId', 'name avatarUrl').lean();
}

export async function getTournamentPrediction(userId: string, language: ApiLanguage) {
  const doc = await TournamentPrediction.findOne({ userId }).lean();
  return serializeTournamentPrediction(doc, language);
}

export async function saveTournamentPrediction(userId: string, input: TournamentPredictionInput, language: ApiLanguage) {
  if (await isTournamentPredictionsLocked()) {
    throw new PredictionServiceError(400, 'Tournament predictions are locked.');
  }

  const catalogError = await validateTournamentPredictionCatalog(input);
  if (catalogError) {
    throw new PredictionServiceError(400, catalogError);
  }

  const update = TEAM_PICK_FIELDS.reduce<Record<string, string | undefined>>((acc, [pickField, codeField]) => {
    acc[codeField] = input[pickField]?.code ? normalizeCode(input[pickField].code) : undefined;
    return acc;
  }, {});

  const doc = await TournamentPrediction.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...update,
        bestPlayer: input.bestPlayer,
        topScorer: input.topScorer,
        bestYoung: input.bestYoung,
      },
    },
    { upsert: true, new: true }
  ).lean();

  return serializeTournamentPrediction(doc, language);
}
