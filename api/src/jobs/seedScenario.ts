import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { calculatePoints } from '../services/scoring';
import { MatchStage, MatchWinner } from '../models/Match';
import { hashPassword } from '../utils/password';
import {
  SCENARIOS,
  ScenarioDefinition,
  getDbName,
  getScenarioDbName,
  scenarioBySlug,
  scenarioList,
  uriWithDbName,
} from './tournamentScenarios';

type Db = ReturnType<ReturnType<typeof mongoose.connection.getClient>['db']>;
type RawDoc = Record<string, any>;

function isObjectId(value: unknown): value is Types.ObjectId {
  return value instanceof Types.ObjectId;
}

interface MatchDoc extends RawDoc {
  _id: Types.ObjectId;
  externalId: number;
  stage: MatchStage;
  utcDate: Date;
  homeTeamCode: string;
  awayTeamCode: string;
  odds?: Record<string, number | null> | null;
  result?: {
    homeGoals: number;
    awayGoals: number;
    winner: MatchWinner;
  } | null;
}

interface PredictionDoc extends RawDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  matchId: Types.ObjectId;
  homeGoals: number;
  awayGoals: number;
  qualifier?: 'HOME' | 'AWAY' | null;
}

interface DemoUser {
  email: string;
  name: string;
  googleId: string;
  profile: PredictionProfile;
}

interface ScenarioDemoResult {
  users: number;
  leagues: number;
  matchPredictions: number;
  groupPredictions: number;
  tournamentPredictions: number;
}

export interface SeedScenarioResult {
  slug: string;
  label: string;
  dbName: string;
  mongodbUri: string;
  tournamentNow: string;
  matches: {
    finished: number;
    live: number;
    total: number;
  };
  demo: ScenarioDemoResult;
  scoring: {
    matchesProcessed: number;
    predictionsScored: number;
    usersUpdated: number;
  };
}

interface PredictionProfile {
  coverage: number;
  exactEvery: number;
  outcomeBias: number;
  volatility: number;
}

const DEMO_PASSWORD = 'demo-password';
const SCENARIO_COLLECTIONS = new Set([
  'matches',
  'countryteams',
  'users',
  'leagues',
  'pushsubscriptions',
  'predictions',
  'grouppredictions',
  'tournamentpredictions',
  'pollconfigs',
]);
const GENERATED_COLLECTIONS = new Set(['predictions', 'grouppredictions', 'tournamentpredictions']);

const DEMO_USERS: DemoUser[] = [
  {
    email: 'dev@worldporra.test',
    name: 'Dev Player',
    googleId: 'dev-user-001',
    profile: { coverage: 1, exactEvery: 4, outcomeBias: 0, volatility: 1 },
  },
  {
    email: 'alex@worldporra.test',
    name: 'Alex Rivera',
    googleId: 'scenario-demo-alex',
    profile: { coverage: 0.98, exactEvery: 5, outcomeBias: 1, volatility: 2 },
  },
  {
    email: 'marta@worldporra.test',
    name: 'Marta Silva',
    googleId: 'scenario-demo-marta',
    profile: { coverage: 0.92, exactEvery: 6, outcomeBias: 2, volatility: 1 },
  },
  {
    email: 'sam@worldporra.test',
    name: 'Sam Patel',
    googleId: 'scenario-demo-sam',
    profile: { coverage: 0.86, exactEvery: 8, outcomeBias: 3, volatility: 2 },
  },
  {
    email: 'lucia@worldporra.test',
    name: 'Lucia Martin',
    googleId: 'scenario-demo-lucia',
    profile: { coverage: 0.8, exactEvery: 7, outcomeBias: 4, volatility: 3 },
  },
  {
    email: 'jamie@worldporra.test',
    name: 'Jamie Brooks',
    googleId: 'scenario-demo-jamie',
    profile: { coverage: 0.72, exactEvery: 10, outcomeBias: 5, volatility: 2 },
  },
  {
    email: 'nina@worldporra.test',
    name: 'Nina Kovac',
    googleId: 'scenario-demo-nina',
    profile: { coverage: 0.65, exactEvery: 9, outcomeBias: 6, volatility: 3 },
  },
  {
    email: 'omar@worldporra.test',
    name: 'Omar Hassan',
    googleId: 'scenario-demo-omar',
    profile: { coverage: 0.58, exactEvery: 12, outcomeBias: 7, volatility: 4 },
  },
];

function usage(): string {
  return [
    'Usage: npm run seed:scenario -- <scenario|all> [more scenarios]',
    '',
    `Scenarios: ${scenarioList(true)}`,
    '',
    'The job clones the configured MONGODB_URI database into suffixed scenario databases.',
  ].join('\n');
}

function deriveWinner(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function stableStringNumber(source: string, salt: number): number {
  let hash = 0;
  const input = `${source}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 104729;
  }
  return hash;
}

function stableNumber(match: MatchDoc, salt: number): number {
  const source = `${match.externalId}:${match.homeTeamCode}:${match.awayTeamCode}:${salt}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 9973;
  }
  return hash;
}

function deterministicObjectId(seed: string): Types.ObjectId {
  const hex = Array.from({ length: 24 }, (_, index) =>
    (stableStringNumber(seed, index) % 16).toString(16)
  ).join('');
  return new Types.ObjectId(hex);
}

function makeResult(match: MatchDoc): { homeGoals: number; awayGoals: number; winner: MatchWinner } {
  let homeGoals = stableNumber(match, 1) % 4;
  let awayGoals = stableNumber(match, 2) % 4;

  if (match.stage !== 'GROUP' && homeGoals === awayGoals) {
    homeGoals = (homeGoals + 1) % 5;
  }

  return {
    homeGoals,
    awayGoals,
    winner: homeGoals > awayGoals ? 'HOME' : awayGoals > homeGoals ? 'AWAY' : 'DRAW',
  };
}

function makeLiveResult(match: MatchDoc): { homeGoals: number; awayGoals: number; winner: MatchWinner } {
  const finalish = makeResult(match);
  const homeGoals = Math.max(0, finalish.homeGoals - (stableNumber(match, 8) % 2));
  const awayGoals = Math.max(0, finalish.awayGoals - (stableNumber(match, 9) % 2));

  return {
    homeGoals,
    awayGoals,
    winner: deriveWinner(homeGoals, awayGoals),
  };
}

function sortMatches(matches: MatchDoc[]): MatchDoc[] {
  return [...matches].sort((a, b) => {
    const dateDiff = new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    return dateDiff || a.externalId - b.externalId;
  });
}

function shouldPickMatch(userId: Types.ObjectId, match: MatchDoc, profile: PredictionProfile): boolean {
  return stableStringNumber(`${userId}:${match.externalId}`, 1) % 100 < profile.coverage * 100;
}

function makePredictedScore(userId: Types.ObjectId, match: MatchDoc, index: number, profile: PredictionProfile) {
  const actual = match.result ?? makeResult(match);
  const exact = profile.exactEvery > 0 && (index + profile.outcomeBias) % profile.exactEvery === 0;

  if (exact) {
    return {
      homeGoals: actual.homeGoals,
      awayGoals: actual.awayGoals,
    };
  }

  const nudgeHome = (stableStringNumber(`${userId}:${match.externalId}`, 2) % (profile.volatility + 2)) - 1;
  const nudgeAway = (stableStringNumber(`${userId}:${match.externalId}`, 3) % (profile.volatility + 2)) - 1;
  let homeGoals = Math.max(0, Math.min(6, actual.homeGoals + nudgeHome));
  let awayGoals = Math.max(0, Math.min(6, actual.awayGoals + nudgeAway));

  const keepOutcome = stableStringNumber(`${userId}:${match.externalId}`, 4) % 100 < 62 - profile.outcomeBias * 4;
  if (keepOutcome && deriveWinner(homeGoals, awayGoals) !== actual.winner) {
    if (actual.winner === 'HOME') {
      homeGoals = Math.max(awayGoals + 1, homeGoals);
    } else if (actual.winner === 'AWAY') {
      awayGoals = Math.max(homeGoals + 1, awayGoals);
    } else {
      awayGoals = homeGoals;
    }
  }

  return { homeGoals, awayGoals };
}

function getMatchTeamCodes(match: MatchDoc): string[] {
  return [match.homeTeamCode, match.awayTeamCode]
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code && code !== 'TBD');
}

function getGroupTeams(matches: MatchDoc[]): Map<string, string[]> {
  const groups = new Map<string, Set<string>>();
  for (const match of matches) {
    if (match.stage !== 'GROUP' || !match.group) continue;
    const group = groups.get(match.group) ?? new Set<string>();
    getMatchTeamCodes(match).forEach((code) => group.add(code));
    groups.set(match.group, group);
  }

  return new Map(
    Array.from(groups.entries())
      .map(([group, codes]) => [group, Array.from(codes).sort()] as const)
      .filter(([, codes]) => codes.length >= 2)
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const normalized = offset % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

async function seedDemoUsersAndLeagues(db: Db): Promise<{ users: RawDoc[]; leagues: number }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  await db.collection('users').bulkWrite(
    DEMO_USERS.map((demo) => ({
      updateOne: {
        filter: { email: demo.email },
        update: {
          $set: {
            googleId: demo.googleId,
            name: demo.name,
            avatarUrl: '',
            passwordHash,
            isMaster: demo.email === 'dev@worldporra.test',
            updatedAt: now,
          },
          $setOnInsert: {
            _id: deterministicObjectId(`user:${demo.email}`),
            email: demo.email,
            totalPoints: 0,
            createdAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const users = await db.collection('users').find({}).sort({ email: 1 }).toArray();
  const demoUsers = await db.collection('users').find({ email: { $in: DEMO_USERS.map((user) => user.email) } }).sort({ email: 1 }).toArray();
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const owner = userByEmail.get('dev@worldporra.test') ?? users[0];

  const leagueSpecs = [
    {
      name: 'Everyone League',
      legacyInviteCode: 'ALL202',
      inviteCode: 'K7M9Q2RX',
      members: users.map((user) => user._id),
    },
    {
      name: 'Family Sweepstake',
      legacyInviteCode: 'FAM026',
      inviteCode: 'F4V8M2QA',
      members: ['dev@worldporra.test', 'alex@worldporra.test', 'marta@worldporra.test', 'lucia@worldporra.test']
        .map((email) => userByEmail.get(email)?._id)
        .filter(isObjectId),
    },
    {
      name: 'Office League',
      legacyInviteCode: 'OFF026',
      inviteCode: 'P9H3T7WK',
      members: ['dev@worldporra.test', 'sam@worldporra.test', 'jamie@worldporra.test', 'nina@worldporra.test', 'omar@worldporra.test']
        .map((email) => userByEmail.get(email)?._id)
        .filter(isObjectId),
    },
    {
      name: 'Weekend Pundits',
      legacyInviteCode: 'PUN026',
      inviteCode: 'N6Q4R8YL',
      members: demoUsers
        .filter((_, index) => index % 2 === 0)
        .map((user) => user._id),
    },
  ];

  await db.collection('leagues').bulkWrite(
    leagueSpecs.map((spec) => {
      const leagueId = deterministicObjectId(`league:${spec.legacyInviteCode}`);
      const members = Array.from(new Set(spec.members.map((id) => id.toString()))).map((id, index) => ({
        userId: new Types.ObjectId(id),
        joinedAt: new Date(now.getTime() - index * 24 * 60 * 60 * 1000),
        isAdmin: id === owner._id.toString(),
      }));

      return {
        updateOne: {
          filter: { _id: leagueId },
          update: {
            $set: {
              name: spec.name,
              inviteCode: spec.inviteCode,
              ownerId: owner._id,
              members,
              maxMembers: 50,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: leagueId,
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false }
  );

  return { users: await db.collection('users').find({}).sort({ email: 1 }).toArray(), leagues: leagueSpecs.length };
}

async function seedDemoPredictions(db: Db, users: RawDoc[]): Promise<Omit<ScenarioDemoResult, 'users' | 'leagues'>> {
  const matches = sortMatches(await db.collection<MatchDoc>('matches').find().toArray());
  const groupTeams = getGroupTeams(matches);
  const now = new Date();
  let matchPredictions = 0;
  let groupPredictions = 0;
  let tournamentPredictions = 0;
  const matchPredictionDocs: RawDoc[] = [];
  const groupPredictionDocs: RawDoc[] = [];
  const tournamentPredictionDocs: RawDoc[] = [];

  const defaultProfile: PredictionProfile = { coverage: 0.75, exactEvery: 9, outcomeBias: 4, volatility: 3 };
  const profiles = new Map(DEMO_USERS.map((user) => [user.email, user.profile]));

  await Promise.all([
    db.collection('predictions').deleteMany({}),
    db.collection('grouppredictions').deleteMany({}),
    db.collection('tournamentpredictions').deleteMany({}),
  ]);

  for (const [userIndex, user] of users.entries()) {
    const profile = profiles.get(user.email) ?? {
      ...defaultProfile,
      outcomeBias: userIndex % 6,
      coverage: Math.max(0.55, defaultProfile.coverage - (userIndex % 4) * 0.05),
    };

    for (const [matchIndex, match] of matches.entries()) {
      if (!shouldPickMatch(user._id, match, profile)) continue;

      const score = makePredictedScore(user._id, match, matchIndex, profile);
      const predictedWinner = deriveWinner(score.homeGoals, score.awayGoals);
      const isKnockout = match.stage !== 'GROUP';
      let qualifier: 'HOME' | 'AWAY' | null = null;

      if (isKnockout) {
        if (predictedWinner === 'HOME') qualifier = 'HOME';
        else if (predictedWinner === 'AWAY') qualifier = 'AWAY';
        else qualifier = stableStringNumber(`${user._id}:${match.externalId}`, 5) % 2 === 0 ? 'HOME' : 'AWAY';
      }

      matchPredictionDocs.push({
        userId: user._id,
        matchId: match._id,
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        predictedWinner,
        qualifier,
        points: null,
        createdAt: now,
        updatedAt: now,
      });
      matchPredictions += 1;
    }

    for (const [group, teamCodes] of groupTeams.entries()) {
      const orderedTeamCodes = rotate(teamCodes, stableStringNumber(`${user._id}:${group}`, 6) % teamCodes.length);
      groupPredictionDocs.push({
        userId: user._id,
        group,
        orderedTeamCodes,
        points: null,
        createdAt: now,
        updatedAt: now,
      });
      groupPredictions += 1;
    }

    const availableCodes = Array.from(new Set(matches.flatMap(getMatchTeamCodes))).sort();
    const picks = rotate(availableCodes, stableStringNumber(user._id.toString(), 7) % Math.max(availableCodes.length, 1));
    tournamentPredictionDocs.push({
      userId: user._id,
      championCode: picks[0],
      runnerUpCode: picks[1],
      semi1Code: picks[2],
      semi2Code: picks[3],
      bestPlayer: { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW', age: 38 },
      topScorer: { name: 'Kylian Mbappe', team: 'France', code: 'FRA', pos: 'FW', age: 27 },
      bestYoung: { name: 'Lamine Yamal', team: 'Spain', code: 'ESP', pos: 'FW', age: 18 },
      createdAt: now,
      updatedAt: now,
    });
    tournamentPredictions += 1;
  }

  await Promise.all([
    matchPredictionDocs.length
      ? db.collection('predictions').insertMany(matchPredictionDocs, { ordered: false })
      : Promise.resolve(),
    groupPredictionDocs.length
      ? db.collection('grouppredictions').insertMany(groupPredictionDocs, { ordered: false })
      : Promise.resolve(),
    tournamentPredictionDocs.length
      ? db.collection('tournamentpredictions').insertMany(tournamentPredictionDocs, { ordered: false })
      : Promise.resolve(),
  ]);

  return { matchPredictions, groupPredictions, tournamentPredictions };
}

async function seedScenarioDemoWorld(db: Db): Promise<ScenarioDemoResult> {
  const { users, leagues } = await seedDemoUsersAndLeagues(db);
  const predictions = await seedDemoPredictions(db, users);
  return {
    users: users.length,
    leagues,
    ...predictions,
  };
}

function getFinishedMatchIds(matches: MatchDoc[], scenario: ScenarioDefinition): Set<string> {
  const finished = new Set<string>();
  const finishAllStages = new Set(scenario.finishAllStages ?? []);

  for (const match of matches) {
    if (finishAllStages.has(match.stage)) {
      finished.add(match._id.toString());
    }
  }

  for (const [stage, count] of Object.entries(scenario.finishPartial ?? {}) as Array<[MatchStage, number]>) {
    const stageMatches = sortMatches(matches.filter((match) => match.stage === stage));
    stageMatches.slice(0, count).forEach((match) => finished.add(match._id.toString()));
  }

  return finished;
}

async function cloneDatabase(sourceDb: Db, targetDb: Db): Promise<void> {
  await targetDb.dropDatabase();

  const collections = await sourceDb.collections();
  for (const sourceCollection of collections) {
    if (sourceCollection.collectionName.startsWith('system.')) continue;
    if (!SCENARIO_COLLECTIONS.has(sourceCollection.collectionName)) continue;

    await targetDb.createCollection(sourceCollection.collectionName);
    const targetCollection = targetDb.collection(sourceCollection.collectionName);

    if (!GENERATED_COLLECTIONS.has(sourceCollection.collectionName)) {
      const docs = await sourceCollection.find().toArray();
      if (docs.length) {
        await targetCollection.insertMany(docs, { ordered: false });
      }
    }

    const indexes = await sourceCollection.indexes();
    const secondaryIndexes = indexes.filter((index: RawDoc) => index.name !== '_id_');
    if (secondaryIndexes.length) {
      await targetCollection.createIndexes(
        secondaryIndexes.map(({ key, name, ...options }: RawDoc) => ({
          key,
          name,
          ...options,
        }))
      );
    }
  }
}

async function resetAndApplyMatches(db: Db, scenario: ScenarioDefinition): Promise<{ finished: number; live: number; total: number }> {
  const matches = sortMatches(await db.collection<MatchDoc>('matches').find().toArray());
  const finishedIds = getFinishedMatchIds(matches, scenario);
  let liveMatchId: Types.ObjectId | null = null;

  if (scenario.liveNext) {
    liveMatchId = matches.find((match) => !finishedIds.has(match._id.toString()))?._id ?? null;
  }

  if (matches.length) {
    await db.collection('matches').bulkWrite(matches.map((match) => {
    const isFinished = finishedIds.has(match._id.toString());
    const isLive = liveMatchId?.equals(match._id) ?? false;

    return {
      updateOne: {
        filter: { _id: match._id },
        update: {
          $set: {
            status: isFinished ? 'FINISHED' : isLive ? 'LIVE' : 'SCHEDULED',
            result: isFinished ? makeResult(match) : isLive ? makeLiveResult(match) : null,
            scoresProcessed: false,
          },
        },
      },
    };
    }), { ordered: false });
  }

  return { finished: finishedIds.size, live: liveMatchId ? 1 : 0, total: matches.length };
}

async function scorePredictions(db: Db): Promise<{ matchesProcessed: number; predictionsScored: number; usersUpdated: number }> {
  await db.collection('predictions').updateMany({}, { $set: { points: null } });

  const finishedMatches = await db.collection<MatchDoc>('matches').find({ status: 'FINISHED', result: { $ne: null } }).toArray();
  let predictionsScored = 0;
  const predictionUpdates: any[] = [];
  const matchUpdates: any[] = [];

  for (const match of finishedMatches) {
    const predictions = await db.collection<PredictionDoc>('predictions').find({ matchId: match._id }).toArray();

    for (const prediction of predictions) {
      const points = calculatePoints({
        predictedHome: prediction.homeGoals,
        predictedAway: prediction.awayGoals,
        actualHome: match.result!.homeGoals,
        actualAway: match.result!.awayGoals,
        stage: match.stage,
        odds: match.odds as never,
        qualifier: prediction.qualifier,
        actualWinner: match.result!.winner,
      });

      predictionUpdates.push({
        updateOne: {
          filter: { _id: prediction._id },
          update: { $set: { points } },
        },
      });
    }

    predictionsScored += predictions.length;
    matchUpdates.push({
      updateOne: {
        filter: { _id: match._id },
        update: { $set: { scoresProcessed: true } },
      },
    });
  }

  await Promise.all([
    predictionUpdates.length ? db.collection('predictions').bulkWrite(predictionUpdates, { ordered: false }) : Promise.resolve(),
    matchUpdates.length ? db.collection('matches').bulkWrite(matchUpdates, { ordered: false }) : Promise.resolve(),
  ]);

  const totals = await db.collection('predictions').aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]).toArray();

  await db.collection('users').updateMany({}, { $set: { totalPoints: 0 } });
  if (totals.length) {
    await db.collection('users').bulkWrite(
      totals.map(({ _id, total }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: { totalPoints: total } },
        },
      })),
      { ordered: false }
    );
  }

  return { matchesProcessed: finishedMatches.length, predictionsScored, usersUpdated: totals.length };
}

async function createScenario(
  sourceDbName: string,
  scenario: ScenarioDefinition,
  baseMongoUri = env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI
): Promise<SeedScenarioResult> {
  const targetDbName = getScenarioDbName(sourceDbName, scenario);
  if (targetDbName === sourceDbName) {
    throw new Error(`Refusing to overwrite source database "${sourceDbName}"`);
  }

  const client = mongoose.connection.getClient();
  const sourceDb = client.db(sourceDbName);
  const targetDb = client.db(targetDbName);

  await cloneDatabase(sourceDb, targetDb);
  const matchResult = await resetAndApplyMatches(targetDb, scenario);
  const demoResult = await seedScenarioDemoWorld(targetDb);
  const scoreResult = await scorePredictions(targetDb);

  return {
    slug: scenario.slug,
    label: scenario.label,
    dbName: targetDbName,
    mongodbUri: uriWithDbName(baseMongoUri, targetDbName),
    tournamentNow: scenario.now,
    matches: matchResult,
    demo: demoResult,
    scoring: scoreResult,
  };
}

function logScenarioResult(result: SeedScenarioResult): void {
  console.log([
    '',
    `${result.label} (${result.slug})`,
    `  DB: ${result.dbName}`,
    `  MONGODB_URI=${result.mongodbUri}`,
    `  TOURNAMENT_NOW=${result.tournamentNow}`,
    `  Matches: ${result.matches.finished} finished, ${result.matches.live} live, ${result.matches.total} total`,
    `  Demo: ${result.demo.users} users, ${result.demo.leagues} leagues, ${result.demo.matchPredictions} match picks`,
    `  Demo picks: ${result.demo.groupPredictions} group, ${result.demo.tournamentPredictions} tournament`,
    `  Scoring: ${result.scoring.predictionsScored} predictions across ${result.scoring.matchesProcessed} matches; ${result.scoring.usersUpdated} users updated`,
  ].join('\n'));
}

export async function seedTournamentScenarios({
  sourceDbName,
  slugs,
}: {
  sourceDbName?: string;
  slugs?: string[];
} = {}): Promise<SeedScenarioResult[]> {
  const requested = slugs?.length ? slugs : ['all'];
  const scenarios = requested.includes('all')
    ? SCENARIOS
    : requested.map((slug) => {
        const scenario = scenarioBySlug(slug);
        if (!scenario) throw new Error(`Unknown scenario "${slug}"`);
        return scenario;
      });

  const baseMongoUri = env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI;
  const baseDbName = sourceDbName ?? getDbName(baseMongoUri);
  const results: SeedScenarioResult[] = [];

  for (const scenario of scenarios) {
    results.push(await createScenario(baseDbName, scenario, baseMongoUri));
  }

  return results;
}

async function main(): Promise<void> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to clone scenario databases');
  }

  const requested = process.argv.slice(2);
  if (!requested.length || requested.includes('--help') || requested.includes('-h')) {
    console.log(usage());
    return;
  }

  const scenarios = requested.includes('all')
    ? SCENARIOS
    : requested.map((slug) => {
        const scenario = scenarioBySlug(slug);
        if (!scenario) throw new Error(`Unknown scenario "${slug}"\n\n${usage()}`);
        return scenario;
      });

  const sourceDbName = getDbName(env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  try {
    for (const scenario of scenarios) {
      logScenarioResult(await createScenario(sourceDbName, scenario, env.MONGODB_URI));
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
