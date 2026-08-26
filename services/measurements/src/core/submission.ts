// The ingest contract — these types mirror the given perimeter in openapi.yaml
// and the examples in fixtures/. They are yours to consume, not to redesign.

export type MeasurementType = 'blood_pressure' | 'body_mass';

export interface MeasurementSubmission {
  /**
   * A submission carries no identifier of its own — the same content may arrive
   * more than once (retries, device re-syncs). Determining what you have
   * already seen is part of your design.
   */
  device: {
    model: string;
    serialNumber: string;
  };
  measurements: SubmittedMeasurement[];
}

export type SubmittedMeasurement = BloodPressureMeasurement | BodyMassMeasurement;

export interface BloodPressureMeasurement {
  type: 'blood_pressure';
  /** When the device took the reading (device-local offset preserved). */
  takenAt: string;
  values: {
    systolic_mmhg: number;
    diastolic_mmhg: number;
    pulse_bpm: number;
    irregular_heartbeat?: boolean;
  };
}

export interface BodyMassMeasurement {
  type: 'body_mass';
  takenAt: string;
  values: {
    /** Body mass in grams. */
    body_mass_g: number;
    /** Bio-impedance in ohms; 0 means the impedance measurement failed. */
    impedance_ohm?: number;
  };
}
