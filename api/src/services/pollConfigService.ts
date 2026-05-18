import { env } from '../config/env';
import { Match } from '../models/Match';
import { PollConfig } from '../models/PollConfig';
import { currentDate } from '../utils/time';

export interface SerializedPollConfig {
  groupPredictionsDeadline: string | null;
  tournamentPredictionsDeadline: string | null;
  leagueCreationDeadline: string | null;
  groupPredictionsLocked: boolean;
  tournamentPredictionsLocked: boolean;
  leagueCreationLocked: boolean;
  serverTime: string;
}

export interface PollConfigUpdate {
  groupPredictionsDeadline?: Date | null;
  tournamentPredictionsDeadline?: Date | null;
}

function parseEnvDate(value: string, name: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid ISO date string`);
  }
  return date;
}

async function getDefaultPicksDeadline(): Promise<Date | null> {
  const sharedDeadline = parseEnvDate(env.POLL_PICKS_DEADLINE, 'POLL_PICKS_DEADLINE');
  if (sharedDeadline) return sharedDeadline;

  const firstGroupMatch = await Match.findOne({ stage: 'GROUP' }).sort({ utcDate: 1 }).select('utcDate').lean();
  return firstGroupMatch?.utcDate ?? null;
}

export async function getLeagueCreationDeadline(): Promise<Date | null> {
  const firstGroupMatch = await Match.findOne({ stage: 'GROUP' }).sort({ utcDate: 1 }).select('utcDate').lean();
  if (!firstGroupMatch?.utcDate) return null;

  return new Date(firstGroupMatch.utcDate.getTime() - 24 * 60 * 60 * 1000);
}

async function resolveDeadline(stored: Date | null | undefined, specificEnvValue: string, envName: string): Promise<Date | null> {
  if (stored !== undefined && stored !== null) return stored;
  return parseEnvDate(specificEnvValue, envName) ?? await getDefaultPicksDeadline();
}

export function serializePollConfig(config: {
  groupPredictionsDeadline: Date | null;
  tournamentPredictionsDeadline: Date | null;
  leagueCreationDeadline: Date | null;
}): SerializedPollConfig {
  const now = currentDate();

  return {
    groupPredictionsDeadline: config.groupPredictionsDeadline?.toISOString() ?? null,
    tournamentPredictionsDeadline: config.tournamentPredictionsDeadline?.toISOString() ?? null,
    leagueCreationDeadline: config.leagueCreationDeadline?.toISOString() ?? null,
    groupPredictionsLocked: !!config.groupPredictionsDeadline && now >= config.groupPredictionsDeadline,
    tournamentPredictionsLocked: !!config.tournamentPredictionsDeadline && now >= config.tournamentPredictionsDeadline,
    leagueCreationLocked: !!config.leagueCreationDeadline && now >= config.leagueCreationDeadline,
    serverTime: now.toISOString(),
  };
}

export async function getPollConfig() {
  const config = await PollConfig.findOne({ key: 'global' }).lean();

  return {
    groupPredictionsDeadline: await resolveDeadline(
      config?.groupPredictionsDeadline,
      env.POLL_GROUP_PREDICTIONS_DEADLINE,
      'POLL_GROUP_PREDICTIONS_DEADLINE'
    ),
    tournamentPredictionsDeadline: await resolveDeadline(
      config?.tournamentPredictionsDeadline,
      env.POLL_TOURNAMENT_PREDICTIONS_DEADLINE,
      'POLL_TOURNAMENT_PREDICTIONS_DEADLINE'
    ),
    leagueCreationDeadline: await getLeagueCreationDeadline(),
  };
}

export async function updatePollConfig(update: PollConfigUpdate) {
  const config = await PollConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    groupPredictionsDeadline: await resolveDeadline(
      config?.groupPredictionsDeadline,
      env.POLL_GROUP_PREDICTIONS_DEADLINE,
      'POLL_GROUP_PREDICTIONS_DEADLINE'
    ),
    tournamentPredictionsDeadline: await resolveDeadline(
      config?.tournamentPredictionsDeadline,
      env.POLL_TOURNAMENT_PREDICTIONS_DEADLINE,
      'POLL_TOURNAMENT_PREDICTIONS_DEADLINE'
    ),
    leagueCreationDeadline: await getLeagueCreationDeadline(),
  };
}

export async function isGroupPredictionsLocked(): Promise<boolean> {
  const { groupPredictionsDeadline } = await getPollConfig();
  return !!groupPredictionsDeadline && currentDate() >= groupPredictionsDeadline;
}

export async function isTournamentPredictionsLocked(): Promise<boolean> {
  const { tournamentPredictionsDeadline } = await getPollConfig();
  return !!tournamentPredictionsDeadline && currentDate() >= tournamentPredictionsDeadline;
}

export async function isLeagueCreationLocked(): Promise<boolean> {
  const leagueCreationDeadline = await getLeagueCreationDeadline();
  return !!leagueCreationDeadline && currentDate() >= leagueCreationDeadline;
}

export async function isTournamentStarted(): Promise<boolean> {
  const firstGroupMatch = await Match.findOne({ stage: 'GROUP' }).sort({ utcDate: 1 }).select('utcDate').lean();
  return !!firstGroupMatch?.utcDate && currentDate() >= firstGroupMatch.utcDate;
}
