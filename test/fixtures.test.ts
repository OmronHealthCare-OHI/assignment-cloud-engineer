import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Proves the test harness runs out of the box. Replace or extend as you see fit.
describe('app submission fixtures', () => {
  const fixturesDir = join(process.cwd(), 'fixtures');
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  it('fixtures are present', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s parses and carries measurements', (file) => {
    const submission = JSON.parse(readFileSync(join(fixturesDir, file), 'utf-8'));

    expect(submission.device.serialNumber).toBeTruthy();
    expect(submission.measurements.length).toBeGreaterThan(0);
  });
});
