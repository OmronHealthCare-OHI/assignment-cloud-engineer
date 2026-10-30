import type { MeasurementSubmission } from './submission.js';

/**
 * Every rule violation at the ingest perimeter surfaces as this error, so
 * transports can map it to a 400 without knowing the rule that fired.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates an untrusted submission against the ingest contract and narrows
 * it to `MeasurementSubmission`. Unknown extra fields are tolerated and
 * returned as-is — the caller gets the original object back.
 */
export function validateSubmission(input: unknown): MeasurementSubmission {
  if (!isRecord(input)) {
    throw new ValidationError('submission must be a JSON object');
  }
  validateDevice(input['device']);
  validateMeasurements(input['measurements']);
  // The checks above establish the shape; the original object (extra fields
  // included) is what callers get back.
  return input as unknown as MeasurementSubmission;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateDevice(device: unknown): void {
  if (!isRecord(device)) {
    throw new ValidationError('device is required and must be an object');
  }
  requireNonEmptyString(device['model'], 'device.model');
  requireNonEmptyString(device['serialNumber'], 'device.serialNumber');
}

function validateMeasurements(measurements: unknown): void {
  if (!Array.isArray(measurements)) {
    throw new ValidationError('measurements is required and must be an array');
  }
  if (measurements.length === 0) {
    throw new ValidationError('measurements must contain at least one measurement');
  }
  for (const [index, measurement] of measurements.entries()) {
    validateMeasurement(measurement, `measurements[${index}]`);
  }
}

function validateMeasurement(measurement: unknown, path: string): void {
  if (!isRecord(measurement)) {
    throw new ValidationError(`${path} must be an object`);
  }
  const type = measurement['type'];
  if (type !== 'blood_pressure' && type !== 'body_mass') {
    throw new ValidationError(`${path}.type must be one of blood_pressure, body_mass`);
  }
  const takenAt = measurement['takenAt'];
  if (typeof takenAt !== 'string' || Number.isNaN(Date.parse(takenAt))) {
    throw new ValidationError(`${path}.takenAt must be an ISO-8601 timestamp string`);
  }
  const values = measurement['values'];
  if (!isRecord(values)) {
    throw new ValidationError(`${path}.values must be an object`);
  }
  if (type === 'blood_pressure') {
    requireFiniteNumber(values['systolic_mmhg'], `${path}.values.systolic_mmhg`);
    requireFiniteNumber(values['diastolic_mmhg'], `${path}.values.diastolic_mmhg`);
    requireFiniteNumber(values['pulse_bpm'], `${path}.values.pulse_bpm`);
    const irregular = values['irregular_heartbeat'];
    if (irregular !== undefined && typeof irregular !== 'boolean') {
      throw new ValidationError(`${path}.values.irregular_heartbeat must be a boolean when present`);
    }
  } else {
    requireNonNegativeInteger(values['body_mass_g'], `${path}.values.body_mass_g`);
    if (values['impedance_ohm'] !== undefined) {
      requireNonNegativeInteger(values['impedance_ohm'], `${path}.values.impedance_ohm`);
    }
  }
}

function requireNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${path} must be a non-empty string`);
  }
}

function requireFiniteNumber(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${path} must be a finite number`);
  }
}

function requireNonNegativeInteger(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${path} must be an integer >= 0`);
  }
}
