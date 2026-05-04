import { MatchStage } from '../models/Match';

export type ScenarioSlug =
  | 'pre-tournament'
  | 'eve'
  | 'group-mid'
  | 'group-late'
  | 'knockout-r32'
  | 'knockout-r16'
  | 'final-eve'
  | 'complete';

export interface ScenarioDefinition {
  slug: ScenarioSlug;
  label: string;
  now: string;
  finishAllStages?: MatchStage[];
  finishPartial?: Partial<Record<MatchStage, number>>;
  liveNext?: boolean;
}

const STAGES: MatchStage[] = [
  'GROUP',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
];

export const SCENARIOS: ScenarioDefinition[] = [
  { slug: 'pre-tournament', label: 'Pre-tournament', now: '2026-06-09T12:00:00Z' },
  { slug: 'eve', label: 'One day before kickoff', now: '2026-06-10T12:00:00Z' },
  { slug: 'group-mid', label: 'Middle of group stage', now: '2026-06-18T12:00:00Z', finishPartial: { GROUP: 24 }, liveNext: true },
  { slug: 'group-late', label: 'Late group stage', now: '2026-06-25T12:00:00Z', finishPartial: { GROUP: 60 }, liveNext: true },
  {
    slug: 'knockout-r32',
    label: 'Round of 32 underway',
    now: '2026-06-29T12:00:00Z',
    finishAllStages: ['GROUP'],
    finishPartial: { ROUND_OF_32: 8 },
    liveNext: true,
  },
  {
    slug: 'knockout-r16',
    label: 'Round of 16 underway',
    now: '2026-07-04T12:00:00Z',
    finishAllStages: ['GROUP', 'ROUND_OF_32'],
    finishPartial: { ROUND_OF_16: 4 },
    liveNext: true,
  },
  {
    slug: 'final-eve',
    label: 'Just before the final',
    now: '2026-07-18T18:00:00Z',
    finishAllStages: ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE'],
  },
  { slug: 'complete', label: 'Tournament complete', now: '2026-07-20T12:00:00Z', finishAllStages: STAGES },
];

const SCENARIO_SUFFIX_PATTERN = SCENARIOS.map((scenario) => scenario.slug.replace(/-/gu, '_')).join('|');

export function scenarioBySlug(slug: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((scenario) => scenario.slug === slug);
}

export function scenarioList(includeAll = false): string {
  return `${SCENARIOS.map((scenario) => scenario.slug).join(', ')}${includeAll ? ', all' : ''}`;
}

export function getDbName(uri: string): string {
  const url = new URL(uri);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return dbName || 'test';
}

export function uriWithDbName(uri: string, dbName: string): string {
  const url = new URL(uri);
  url.pathname = `/${encodeURIComponent(dbName)}`;
  return url.toString();
}

export function getScenarioDbName(sourceDbName: string, scenario: ScenarioDefinition): string {
  const suffixPattern = new RegExp(`_(${SCENARIO_SUFFIX_PATTERN})$`, 'u');
  const baseName = sourceDbName.replace(suffixPattern, '');
  return `${baseName}_${scenario.slug.replace(/-/gu, '_')}`;
}
