import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './apiError';

describe('getApiErrorMessage', () => {
  it('prefers API error strings', () => {
    expect(getApiErrorMessage({ response: { data: { error: 'Locked' } } }, 'Fallback')).toBe('Locked');
  });

  it('uses text bodies and thrown messages before the fallback', () => {
    expect(getApiErrorMessage({ response: { data: 'Nope' } }, 'Fallback')).toBe('Nope');
    expect(getApiErrorMessage(new Error('Network down'), 'Fallback')).toBe('Network down');
  });

  it('returns the fallback when no useful message exists', () => {
    expect(getApiErrorMessage({ response: { data: {} } }, 'Fallback')).toBe('Fallback');
  });
});
