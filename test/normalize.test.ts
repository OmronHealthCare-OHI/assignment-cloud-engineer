import { describe, expect, it } from 'vitest';

import {
  buildPartitionKey,
  buildSortKey,
  buildTypeTimeKey,
  toUtcTimestamp
} from '../services/measurements/src/core/normalize.js';
import { ValidationError } from '../services/measurements/src/core/validate-submission.js';

describe('toUtcTimestamp', () => {
  it('converts a device-local offset to UTC', () => {
    expect(toUtcTimestamp('2026-08-25T08:14:12+02:00')).toBe('2026-08-25T06:14:12.000Z');
  });

  it('normalizes a Z timestamp to the fixed format', () => {
    expect(toUtcTimestamp('2026-08-25T07:34:35Z')).toBe('2026-08-25T07:34:35.000Z');
  });

  it('preserves fractional seconds', () => {
    expect(toUtcTimestamp('2026-08-25T07:34:35.123Z')).toBe('2026-08-25T07:34:35.123Z');
  });

  it('crosses the date boundary with a negative offset', () => {
    expect(toUtcTimestamp('2026-08-25T21:18:03-05:00')).toBe('2026-08-26T02:18:03.000Z');
  });

  it('throws ValidationError on an unparseable timestamp', () => {
    expect(() => toUtcTimestamp('yesterday morning')).toThrow(ValidationError);
  });
});

describe('key builders', () => {
  it('buildPartitionKey trims and joins model and serial', () => {
    expect(buildPartitionKey(' HEM-7361T ', 'BP-4F2A-009318 ')).toBe('HEM-7361T#BP-4F2A-009318');
  });

  it('buildSortKey joins takenAtUtc and type', () => {
    expect(buildSortKey('2026-08-25T06:14:12.000Z', 'blood_pressure')).toBe(
      '2026-08-25T06:14:12.000Z#blood_pressure'
    );
  });

  it('buildTypeTimeKey trims and joins time, model, serial', () => {
    expect(
      buildTypeTimeKey('2026-08-25T06:14:12.000Z', ' HEM-7361T', 'BP-4F2A-009318 ')
    ).toBe('2026-08-25T06:14:12.000Z#HEM-7361T#BP-4F2A-009318');
  });
});

describe('takenAtUtc ordering', () => {
  it('lexicographic order matches chronological order across offsets', () => {
    const earlier = toUtcTimestamp('2026-08-25T21:18:03+02:00'); // 2026-08-25T19:18:03.000Z
    const later = toUtcTimestamp('2026-08-25T21:00:00-05:00'); // 2026-08-26T02:00:00.000Z

    expect(earlier < later).toBe(true);
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});
