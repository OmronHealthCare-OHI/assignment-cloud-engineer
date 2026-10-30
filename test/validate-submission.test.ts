import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ValidationError,
  validateSubmission
} from '../services/measurements/src/core/validate-submission.js';

const fixturesDir = join(process.cwd(), 'fixtures');
const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

function validSubmission() {
  return {
    device: { model: 'HEM-7361T', serialNumber: 'BP-4F2A-009318' },
    measurements: [
      {
        type: 'blood_pressure',
        takenAt: '2026-08-25T08:14:12+02:00',
        values: { systolic_mmhg: 128, diastolic_mmhg: 84, pulse_bpm: 71 }
      }
    ]
  };
}

describe('validateSubmission', () => {
  it('ValidationError is an Error named ValidationError', () => {
    const error = new ValidationError('nope');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
  });

  it.each(fixtureFiles)('%s passes validation unchanged', async (file) => {
    const submission = JSON.parse(await readFile(join(fixturesDir, file), 'utf-8'));

    expect(validateSubmission(submission)).toEqual(submission);
  });

  it('tolerates unknown extra fields and returns them as-is', () => {
    const submission = {
      ...validSubmission(),
      appVersion: '4.2.1',
      measurements: [{ ...validSubmission().measurements[0], battery_pct: 81 }]
    };

    expect(validateSubmission(submission)).toEqual(submission);
  });

  it('throws on a non-object input', () => {
    expect(() => validateSubmission(null)).toThrow(ValidationError);
    expect(() => validateSubmission('measurements')).toThrow(ValidationError);
  });

  it('throws on a missing device', () => {
    const { device: _device, ...rest } = validSubmission();

    expect(() => validateSubmission(rest)).toThrow(ValidationError);
  });

  it('throws on an empty (after trim) serial number', () => {
    const submission = validSubmission();
    submission.device.serialNumber = '   ';

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on an empty measurements array', () => {
    const submission = { ...validSubmission(), measurements: [] };

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on an unknown measurement type', () => {
    const submission = validSubmission();
    submission.measurements[0]!.type = 'heart_rate';

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on an unparseable takenAt', () => {
    const submission = validSubmission();
    submission.measurements[0]!.takenAt = 'last tuesday';

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on a missing required value field', () => {
    const submission = validSubmission();
    delete (submission.measurements[0]!.values as Record<string, unknown>).systolic_mmhg;

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on a wrong value type (string instead of number)', () => {
    const submission = validSubmission();
    (submission.measurements[0]!.values as Record<string, unknown>).pulse_bpm = '71';

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on a negative body mass', () => {
    const submission = {
      ...validSubmission(),
      measurements: [
        { type: 'body_mass', takenAt: '2026-08-25T07:34:35Z', values: { body_mass_g: -1 } }
      ]
    };

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });

  it('throws on a non-integer impedance', () => {
    const submission = {
      ...validSubmission(),
      measurements: [
        {
          type: 'body_mass',
          takenAt: '2026-08-25T07:34:35Z',
          values: { body_mass_g: 82400, impedance_ohm: 512.5 }
        }
      ]
    };

    expect(() => validateSubmission(submission)).toThrow(ValidationError);
  });
});
