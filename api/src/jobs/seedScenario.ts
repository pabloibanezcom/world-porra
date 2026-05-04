import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { calculatePoints } from '../services/scoring';
import { MatchStage, MatchWinner } from '../models/Match';
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

function usage(): string {
  return [
    'Usage: npm run seed:scenario -- <scenario|all> [more scenarios]',
    '',
    `Scenarios: ${scenarioList(true)}`,
    '',
    'The job clones the configured MONGODB_URI database into suffixed scenario databases.',
  ].join('\n');
}

function stableNumber(match: MatchDoc, salt: number): number {
  const source = `${match.externalId}:${match.homeTeamCode}:${match.awayTeamCode}:${salt}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 9973;
  }
  return hash;
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

function sortMatches(matches: MatchDoc[]): MatchDoc[] {
  return [...matches].sort((a, b) => {
    const dateDiff = new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    return dateDiff || a.externalId - b.externalId;
  });
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

    await targetDb.createCollection(sourceCollection.collectionName);
    const targetCollection = targetDb.collection(sourceCollection.collectionName);

    const docs = await sourceCollection.find().toArray();
    if (docs.length) {
      await targetCollection.insertMany(docs, { ordered: false });
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

  for (const match of matches) {
    const isFinished = finishedIds.has(match._id.toString());
    const isLive = liveMatchId?.equals(match._id) ?? false;

    await db.collection('matches').updateOne(
      { _id: match._id },
      {
        $set: {
          status: isFinished ? 'FINISHED' : isLive ? 'LIVE' : 'SCHEDULED',
          result: isFinished ? makeResult(match) : null,
          scoresProcessed: false,
        },
      }
    );
  }

  return { finished: finishedIds.size, live: liveMatchId ? 1 : 0, total: matches.length };
}

async function scorePredictions(db: Db): Promise<{ matchesProcessed: number; predictionsScored: number; usersUpdated: number }> {
  await db.collection('predictions').updateMany({}, { $set: { points: null } });

  const finishedMatches = await db.collection<MatchDoc>('matches').find({ status: 'FINISHED', result: { $ne: null } }).toArray();
  let predictionsScored = 0;

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

      await db.collection('predictions').updateOne({ _id: prediction._id }, { $set: { points } });
    }

    predictionsScored += predictions.length;
    await db.collection('matches').updateOne({ _id: match._id }, { $set: { scoresProcessed: true } });
  }

  const totals = await db.collection('predictions').aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]).toArray();

  await db.collection('users').updateMany({}, { $set: { totalPoints: 0 } });
  for (const { _id, total } of totals) {
    await db.collection('users').updateOne({ _id }, { $set: { totalPoints: total } });
  }

  return { matchesProcessed: finishedMatches.length, predictionsScored, usersUpdated: totals.length };
}

async function createScenario(sourceDbName: string, scenario: ScenarioDefinition): Promise<void> {
  const targetDbName = getScenarioDbName(sourceDbName, scenario);
  if (targetDbName === sourceDbName) {
    throw new Error(`Refusing to overwrite source database "${sourceDbName}"`);
  }

  const client = mongoose.connection.getClient();
  const sourceDb = client.db(sourceDbName);
  const targetDb = client.db(targetDbName);

  await cloneDatabase(sourceDb, targetDb);
  const matchResult = await resetAndApplyMatches(targetDb, scenario);
  const scoreResult = await scorePredictions(targetDb);

  console.log([
    '',
    `${scenario.label} (${scenario.slug})`,
    `  DB: ${targetDbName}`,
    `  MONGODB_URI=${uriWithDbName(env.MONGODB_URI, targetDbName)}`,
    `  TOURNAMENT_NOW=${scenario.now}`,
    `  Matches: ${matchResult.finished} finished, ${matchResult.live} live, ${matchResult.total} total`,
    `  Scoring: ${scoreResult.predictionsScored} predictions across ${scoreResult.matchesProcessed} matches; ${scoreResult.usersUpdated} users updated`,
  ].join('\n'));
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
      await createScenario(sourceDbName, scenario);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
