import { Request } from 'express';
import { CountryTeam, ICountryTeam } from '../models/CountryTeam';
import { GroupPrediction } from '../models/GroupPrediction';
import { Match } from '../models/Match';
import { TournamentPrediction } from '../models/TournamentPrediction';

export type ApiLanguage = 'en' | 'es';

export interface LocalizedTeamInfo {
  code: string;
  name: string;
  crest: string;
  color: string;
}

export interface TournamentCatalogTeam extends LocalizedTeamInfo {
  players: Array<{
    name: string;
    pos: 'FW' | 'MF' | 'DF' | 'GK';
    age: number;
  }>;
}

type TeamCatalogEntry = Pick<ICountryTeam, 'code' | 'crest' | 'color'> & {
  names: Map<string, string> | Record<string, string>;
  players?: ICountryTeam['players'];
};

function normalizeCode(code: string | null | undefined): string {
  return code?.trim().toUpperCase() || 'TBD';
}

export function getRequestLanguage(req: Request): ApiLanguage {
  const explicit = typeof req.query.lang === 'string' ? req.query.lang : undefined;
  const header = req.headers['accept-language'];
  const raw = explicit ?? (Array.isArray(header) ? header[0] : header);
  return raw?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function getName(names: TeamCatalogEntry['names'], language: ApiLanguage, fallbackCode: string): string {
  if (names instanceof Map) {
    return names.get(language) ?? names.get('en') ?? fallbackCode;
  }

  return names[language] ?? names.en ?? fallbackCode;
}

function getFallbackName(code: string, language: ApiLanguage): string {
  if (code === 'TBD') return language === 'es' ? 'P/D' : 'TBD';
  return code;
}

export function localizeTeam(
  team: TeamCatalogEntry | null | undefined,
  code: string,
  language: ApiLanguage,
): LocalizedTeamInfo {
  const normalizedCode = normalizeCode(code);
  return {
    code: normalizedCode,
    name: team ? getName(team.names, language, normalizedCode) : getFallbackName(normalizedCode, language),
    crest: team?.crest ?? '',
    color: team?.color ?? '',
  };
}

export async function upsertCountryTeamFromSource({
  code,
  name,
  crest,
  players,
}: {
  code: string;
  name: string;
  crest?: string;
  players?: ICountryTeam['players'];
}): Promise<void> {
  const normalizedCode = normalizeCode(code);
  const normalizedName = name.trim() || getFallbackName(normalizedCode, 'en');

  await CountryTeam.findOneAndUpdate(
    { code: normalizedCode },
    {
      $setOnInsert: {
        code: normalizedCode,
        names: {
          en: normalizedName,
          es: normalizedCode === 'TBD' ? getFallbackName(normalizedCode, 'es') : normalizedName,
        },
      },
      ...(crest ? { $set: { crest } } : {}),
      ...(players ? { $set: { players } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function getTeamCatalog(codes: string[]): Promise<Map<string, TeamCatalogEntry>> {
  const normalizedCodes = Array.from(new Set(codes.map(normalizeCode)));
  const teams = await CountryTeam.find({ code: { $in: normalizedCodes } }).lean();
  return new Map(teams.map((team) => [team.code, team]));
}

function serializeCatalogTeam(team: TeamCatalogEntry, language: ApiLanguage): TournamentCatalogTeam {
  return {
    ...localizeTeam(team, team.code, language),
    players: (team.players ?? []).map((player) => ({
      name: player.name,
      pos: player.pos,
      age: player.age,
    })),
  };
}

export async function getTournamentParticipantCodes(): Promise<string[]> {
  const [homeCodes, awayCodes] = await Promise.all([
    Match.distinct('homeTeamCode', { homeTeamCode: { $nin: [null, '', 'TBD'] } }),
    Match.distinct('awayTeamCode', { awayTeamCode: { $nin: [null, '', 'TBD'] } }),
  ]);
  return Array.from(new Set([...homeCodes, ...awayCodes].map(normalizeCode)))
    .filter((code) => code !== 'TBD');
}

export async function getTournamentCatalog(language: ApiLanguage): Promise<TournamentCatalogTeam[]> {
  const participatingCodes = await getTournamentParticipantCodes();
  if (participatingCodes.length === 0) return [];

  const teams = await CountryTeam.find({ code: { $in: participatingCodes } }).lean();
  const orderedTeams = teams
    .map((team) => serializeCatalogTeam(team, language))
    .sort((a, b) => a.name.localeCompare(b.name));

  return orderedTeams;
}

export async function hydrateMatch<T extends Record<string, any>>(
  match: T,
  language: ApiLanguage,
  catalog?: Map<string, TeamCatalogEntry>,
) {
  const homeCode = normalizeCode(match.homeTeamCode ?? match.homeTeam?.code);
  const awayCode = normalizeCode(match.awayTeamCode ?? match.awayTeam?.code);
  const teamCatalog = catalog ?? await getTeamCatalog([homeCode, awayCode]);

  return {
    ...match,
    homeTeamCode: homeCode,
    awayTeamCode: awayCode,
    homeTeam: localizeTeam(teamCatalog.get(homeCode), homeCode, language),
    awayTeam: localizeTeam(teamCatalog.get(awayCode), awayCode, language),
  };
}

export async function hydrateMatches<T extends Record<string, any>>(matches: T[], language: ApiLanguage) {
  const codes = matches.flatMap((match) => [
    match.homeTeamCode ?? match.homeTeam?.code,
    match.awayTeamCode ?? match.awayTeam?.code,
  ]);
  const catalog = await getTeamCatalog(codes);
  return Promise.all(matches.map((match) => hydrateMatch(match, language, catalog)));
}

export async function hydrateTeamCodes(codes: string[], language: ApiLanguage) {
  const catalog = await getTeamCatalog(codes);
  return codes.map((code) => {
    const normalizedCode = normalizeCode(code);
    return localizeTeam(catalog.get(normalizedCode), normalizedCode, language);
  });
}

export function getMatchTeamCodes(match: Record<string, any>) {
  return {
    homeTeamCode: normalizeCode(match.homeTeamCode ?? match.homeTeam?.code),
    awayTeamCode: normalizeCode(match.awayTeamCode ?? match.awayTeam?.code),
  };
}

export async function backfillCountryCodes(): Promise<void> {
  const legacyMatches = await Match.find({
    $or: [
      { homeTeamCode: { $exists: false } },
      { awayTeamCode: { $exists: false } },
    ],
  })
    .select('+homeTeam +awayTeam')
    .lean();

  await Promise.all(
    legacyMatches.map((match) => {
      const { homeTeamCode, awayTeamCode } = getMatchTeamCodes(match);
      return Match.updateOne(
        { _id: match._id },
        { $set: { homeTeamCode, awayTeamCode } }
      );
    })
  );

  const legacyGroupPredictions = await GroupPrediction.collection
    .find({ orderedTeamCodes: { $exists: false }, orderedTeams: { $exists: true } })
    .toArray();

  await Promise.all(
    legacyGroupPredictions.map((prediction) =>
      GroupPrediction.collection.updateOne(
        { _id: prediction._id },
        {
          $set: {
            orderedTeamCodes: (prediction.orderedTeams ?? []).map((team: { code: string }) => normalizeCode(team.code)),
          },
        }
      )
    )
  );

  const legacyTournamentPredictions = await TournamentPrediction.collection
    .find({
      $or: [
        { championCode: { $exists: false }, champion: { $exists: true } },
        { runnerUpCode: { $exists: false }, runnerUp: { $exists: true } },
        { semi1Code: { $exists: false }, semi1: { $exists: true } },
        { semi2Code: { $exists: false }, semi2: { $exists: true } },
      ],
    })
    .toArray();

  await Promise.all(
    legacyTournamentPredictions.map((prediction) => {
      const $set: Record<string, string> = {};
      if (prediction.champion?.code) $set.championCode = normalizeCode(prediction.champion.code);
      if (prediction.runnerUp?.code) $set.runnerUpCode = normalizeCode(prediction.runnerUp.code);
      if (prediction.semi1?.code) $set.semi1Code = normalizeCode(prediction.semi1.code);
      if (prediction.semi2?.code) $set.semi2Code = normalizeCode(prediction.semi2.code);

      return TournamentPrediction.collection.updateOne({ _id: prediction._id }, { $set });
    })
  );
}
