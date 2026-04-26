import { Request } from 'express';
import { CountryTeam, ICountryTeam } from '../models/CountryTeam';
import { GroupPrediction } from '../models/GroupPrediction';
import { Match } from '../models/Match';
import { TournamentPrediction } from '../models/TournamentPrediction';
import { COUNTRY_TEAMS, CountryTeamSeed } from '../data/countryTeams';

export type ApiLanguage = 'en' | 'es';

export interface LocalizedTeamInfo {
  code: string;
  name: string;
  crest: string;
}

type TeamCatalogEntry = Pick<ICountryTeam, 'code' | 'crest' | 'aliases'> & {
  names: Map<string, string> | Record<string, string>;
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

export function localizeTeam(
  team: TeamCatalogEntry | null | undefined,
  code: string,
  language: ApiLanguage,
): LocalizedTeamInfo {
  const normalizedCode = normalizeCode(code);
  return {
    code: normalizedCode,
    name: team ? getName(team.names, language, normalizedCode) : normalizedCode,
    crest: team?.crest ?? '',
  };
}

export async function seedCountryTeams(): Promise<void> {
  await Promise.all(
    COUNTRY_TEAMS.map((team) =>
      CountryTeam.findOneAndUpdate(
        { code: team.code },
        {
          code: team.code,
          names: team.names,
          crest: team.crest ?? '',
          aliases: team.aliases ?? [],
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
}

export async function upsertCountryTeamFromSource({
  code,
  name,
  crest,
}: {
  code: string;
  name: string;
  crest?: string;
}): Promise<void> {
  const normalizedCode = normalizeCode(code);
  if (normalizedCode === 'TBD') {
    await seedCountryTeams();
    return;
  }

  const seeded = COUNTRY_TEAMS.find((team) => team.code === normalizedCode);
  const names: CountryTeamSeed['names'] = seeded?.names ?? { en: name, es: name };

  await CountryTeam.findOneAndUpdate(
    { code: normalizedCode },
    {
      $setOnInsert: {
        code: normalizedCode,
        names,
        aliases: seeded?.aliases ?? [],
      },
      ...(crest ? { $set: { crest } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function getTeamCatalog(codes: string[]): Promise<Map<string, TeamCatalogEntry>> {
  const normalizedCodes = Array.from(new Set(codes.map(normalizeCode)));
  const teams = await CountryTeam.find({ code: { $in: normalizedCodes } }).lean();
  return new Map(teams.map((team) => [team.code, team]));
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
