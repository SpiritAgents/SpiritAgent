export class RealtimeCapabilityError extends Error {
  readonly capability: string;
  readonly providerId: string;

  constructor(providerId: string, capability: string, message: string) {
    super(message);
    this.name = 'RealtimeCapabilityError';
    this.providerId = providerId;
    this.capability = capability;
  }
}

export class RealtimeNotImplementedError extends Error {
  readonly providerId: string;
  readonly connectionKind: string;

  constructor(providerId: string, connectionKind: string, message: string) {
    super(message);
    this.name = 'RealtimeNotImplementedError';
    this.providerId = providerId;
    this.connectionKind = connectionKind;
  }
}
