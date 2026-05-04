import { env } from '../config/env';
import { getRequestContext } from './requestContext';

export function currentDate(): Date {
  const { tournamentNow } = getRequestContext();
  if (tournamentNow) {
    const override = new Date(tournamentNow);
    if (Number.isNaN(override.getTime())) {
      throw new Error('Request tournament time must be a valid ISO date string');
    }
    return override;
  }

  if (env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test' && env.TOURNAMENT_NOW) {
    const override = new Date(env.TOURNAMENT_NOW);
    if (Number.isNaN(override.getTime())) {
      throw new Error('TOURNAMENT_NOW must be a valid ISO date string');
    }
    return override;
  }

  return new Date();
}
