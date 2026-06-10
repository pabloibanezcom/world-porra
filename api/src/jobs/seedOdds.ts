/**
 * Seeds realistic mock betting odds onto matches using ELO-based probabilities.
 * ELO ratings sourced from World Football ELO (worldfootball.net / eloratings.net), ~mid-2025.
 * Run with: npm run seed:odds
 */
import { connectDB } from '../config/db';
import { Match } from '../models/Match';
import { logger } from '../config/logger';

// ELO ratings (~mid-2025). Default for unknown teams: 1450.
const TEAM_ELO: Record<string, number> = {
  // South America
  ARG: 1843, // World champions
  BRA: 1762,
  URU: 1671,
  COL: 1663,
  ECU: 1521,
  CHI: 1487,
  VEN: 1479,
  PAR: 1472,
  PER: 1509,
  BOL: 1437,

  // Europe
  FRA: 1789,
  ENG: 1782,
  ESP: 1758, // Euro 2024 winners
  POR: 1739,
  NED: 1721,
  GER: 1710,
  BEL: 1682,
  CRO: 1649,
  ITA: 1641,
  SUI: 1582,
  DEN: 1575,
  AUT: 1558,
  SCO: 1531,
  SRB: 1539,
  UKR: 1534,
  TUR: 1527,
  POL: 1517,
  CZE: 1510,
  SVK: 1495,
  HUN: 1501,
  ROU: 1488,
  GRE: 1479,
  SVN: 1472,
  ALB: 1442,
  ISL: 1458,
  WAL: 1468,
  IRL: 1441,
  NOR: 1511,
  FIN: 1433,

  // Africa
  MAR: 1656, // 2022 WC semi-finalists
  SEN: 1623,
  NGA: 1493,
  CIV: 1492,
  EGY: 1499,
  GHA: 1458,
  CMR: 1451,
  ALG: 1471,
  TUN: 1462,
  RSA: 1434,
  COD: 1457, // DR Congo
  KEN: 1389,
  CPV: 1451, // Cape Verde — stronger than rank suggests
  GNQ: 1431, // Equatorial Guinea

  // Asia
  JPN: 1597, // consistently strong
  KOR: 1548,
  IRN: 1488,
  AUS: 1542,
  KSA: 1467,
  UZB: 1472,
  JOR: 1421,
  IRQ: 1451,
  CHN: 1451,
  IDN: 1389,
  BHR: 1393,
  KWT: 1382,
  QAT: 1441,
  UAE: 1422,
  SYR: 1398,
  TJK: 1401,
  KGZ: 1378,

  // CONCACAF
  USA: 1612,
  MEX: 1605,
  CAN: 1503,
  CRC: 1441,
  HON: 1420,
  PAN: 1429,
  JAM: 1391,
  HTI: 1362,
  SLV: 1398,
  GUA: 1401,
  CUB: 1339,
  TRI: 1421, // Trinidad & Tobago
  CUW: 1382, // Curaçao
  GUY: 1355, // Guyana

  // Oceania
  NZL: 1403,
  NCL: 1341, // New Caledonia
  FIJ: 1348,
  SOL: 1321, // Solomon Islands

  // TBD placeholder
  TBD: 1450,
};

function getElo(code: string): number {
  return TEAM_ELO[code] ?? 1450;
}

/**
 * Converts ELO ratings to home-win / draw / away-win probabilities.
 *
 * Formula:
 *   base win prob = standard ELO expected score (no home advantage — neutral WC venues)
 *   draw prob peaks at ~28% when teams are equal, falls as the gap widens
 *   win/loss probs absorb the remainder proportionally
 */
function computeProbabilities(homeElo: number, awayElo: number): { home: number; draw: number; away: number } {
  const diff = homeElo - awayElo;

  // Standard ELO win probability
  const baseHomeWin = 1 / (1 + Math.pow(10, -diff / 400));

  // Draw probability peaks at 28% for equal teams, shrinks with ELO gap
  const drawProb = 0.28 * Math.exp(-(diff * diff) / 120000);

  const nonDraw = 1 - drawProb;
  const homeWin = baseHomeWin * nonDraw;
  const awayWin = (1 - baseHomeWin) * nonDraw;

  return { home: homeWin, draw: drawProb, away: awayWin };
}

/** Convert probability to decimal odds with a bookmaker margin (overround). */
function toDecimalOdds(probability: number, margin = 0.07): number {
  const fair = 1 / probability;
  return Math.round(fair * (1 - margin) * 100) / 100;
}

function generateOdds(homeCode: string, awayCode: string): { home: number; draw: number; away: number } {
  const probs = computeProbabilities(getElo(homeCode), getElo(awayCode));
  return {
    home: toDecimalOdds(probs.home),
    draw: toDecimalOdds(probs.draw),
    away: toDecimalOdds(probs.away),
  };
}

async function seedOdds(): Promise<void> {
  await connectDB();

  const matches = await Match.find({
    status: { $in: ['SCHEDULED', 'LIVE', 'FINISHED'] },
    odds: null,
  });

  if (matches.length === 0) {
    logger.info('All matches already have odds — nothing to seed');
    process.exit(0);
  }

  for (const match of matches) {
    const odds = generateOdds(match.homeTeamCode, match.awayTeamCode);
    await Match.updateOne(
      { _id: match._id },
      { $set: { odds: { ...odds, fetchedAt: new Date() } } }
    );
    logger.info(
      { home: match.homeTeamCode, away: match.awayTeamCode, odds },
      'Seeded odds'
    );
  }

  logger.info(`Seeded mock odds for ${matches.length} matches`);
  process.exit(0);
}

seedOdds().catch((err) => {
  logger.error({ err }, 'seedOdds failed');
  process.exit(1);
});
