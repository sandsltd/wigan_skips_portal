export const SERVICE_TYPES = ['collection', 'delivery', 'exchange', 'other'] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

export interface ServiceRequestInput {
  customerReference: string;
  serviceType: ServiceType;
  description: string;
  additionalInfo: string;
}

export type ServiceRequestParseResult =
  | { ok: true; value: ServiceRequestInput }
  | { ok: false; error: string };

const MAX_REFERENCE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_ADDITIONAL_INFO_LENGTH = 2_000;

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidReference(reference: string): boolean {
  if (!reference || reference.length > MAX_REFERENCE_LENGTH) return false;
  if (reference.includes('..') || reference.includes('/') || reference.includes('\\')) return false;
  return /^[A-Za-z0-9\-_ ]+$/.test(reference);
}

export function formatServiceType(serviceType: ServiceType): string {
  return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
}

export function parseServiceRequestInput(value: unknown): ServiceRequestParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'A valid service request is required' };
  }

  const input = value as Record<string, unknown>;
  const customerReference = readTrimmedString(input.customerReference);
  const serviceType = readTrimmedString(input.serviceType).toLowerCase();
  const description = readTrimmedString(input.description);
  const additionalInfo = readTrimmedString(input.additionalInfo);

  if (!isValidReference(customerReference)) {
    return { ok: false, error: 'A valid customer reference is required' };
  }
  if (!SERVICE_TYPES.includes(serviceType as ServiceType)) {
    return { ok: false, error: 'Please select a valid service type' };
  }
  if (!description) {
    return { ok: false, error: 'Please describe what is being collected or delivered' };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: 'The service description is too long' };
  }
  if (additionalInfo.length > MAX_ADDITIONAL_INFO_LENGTH) {
    return { ok: false, error: 'The additional information is too long' };
  }

  return {
    ok: true,
    value: {
      customerReference,
      serviceType: serviceType as ServiceType,
      description,
      additionalInfo,
    },
  };
}
