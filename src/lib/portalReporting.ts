export const MAX_PORTAL_REPORT_DAYS = 5 * 366;

export interface PortalReportRange {
  from: string;
  to: string;
}

export interface PortalReportSourceStop {
  id: string | number;
  status?: unknown;
  stop_type?: unknown;
  customer_reference?: unknown;
  completed_at?: unknown;
  service_request_id?: unknown;
  actual_items?: unknown;
  planned_items?: unknown;
  collection_data?: unknown;
  financial_data?: unknown;
}

export interface PortalReportSourceServiceRequestItem {
  service_request_id?: unknown;
  container_id?: unknown;
  base_price?: unknown;
  total_price?: unknown;
  total_weight?: unknown;
  manual_price?: unknown;
  quantity?: unknown;
  manual_quantity?: unknown;
  is_chargeable?: unknown;
  is_delivery?: unknown;
  billing_type?: unknown;
  container_data?: unknown;
  waste_stream_data?: unknown;
  pricing_package_data?: unknown;
}

export interface PortalReportSourceServiceRequest {
  id: string | number;
  metadata?: unknown;
  collection_charge?: unknown;
  delivery_charge?: unknown;
  postage_cost?: unknown;
  items?: PortalReportSourceServiceRequestItem[];
}

export interface PortalReportSourceSurcharge {
  surcharge_type?: unknown;
  value?: unknown;
  effective_from?: unknown;
}

export interface PortalReportPricingContext {
  serviceRequests?: PortalReportSourceServiceRequest[];
  surcharges?: PortalReportSourceSurcharge[];
}

export interface PortalReportCollection {
  id: string;
  date: string;
  reference: string;
  materials: string[];
  quantity: number;
  weightKg: number;
  weightPending: boolean;
  weightEstimated: boolean;
  costExVat: number;
  costPending: boolean;
}

export interface PortalReport {
  summary: {
    collections: number;
    totalCostExVat: number;
    totalWeightKg: number;
    pendingWeightCollections: number;
    estimatedWeightCollections: number;
    pendingCostCollections: number;
    averageCostExVat: number;
  };
  monthly: Array<{
    month: string;
    label: string;
    collections: number;
    costExVat: number;
    weightKg: number;
    pendingWeightCollections: number;
    estimatedWeightCollections: number;
    pendingCostCollections: number;
  }>;
  wasteStreams: Array<{
    name: string;
    collections: number;
    quantity: number;
    weightKg: number;
    pendingWeightCollections: number;
    estimatedWeightCollections: number;
  }>;
  collections: PortalReportCollection[];
}

type JsonRecord = Record<string, unknown>;

function jsonObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function jsonArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(jsonObject) : [];
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundWeight(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return formatIsoDay(parsed) === value ? parsed : null;
}

export function parsePortalReportRange(
  fromValue: string | null,
  toValue: string | null,
  now = new Date(),
): { range: PortalReportRange } | { error: string } {
  const defaultTo = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 89);

  const from = fromValue || formatIsoDay(defaultFrom);
  const to = toValue || formatIsoDay(defaultTo);
  const fromDate = parseIsoDay(from);
  const toDate = parseIsoDay(to);

  if (!fromDate || !toDate) {
    return { error: 'Dates must use the YYYY-MM-DD format' };
  }
  if (fromDate > toDate) {
    return { error: 'The start date must be on or before the end date' };
  }

  const inclusiveDays = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / 86_400_000,
  ) + 1;
  if (inclusiveDays > MAX_PORTAL_REPORT_DAYS) {
    return { error: 'The selected period cannot be longer than five years' };
  }

  return { range: { from, to } };
}

function isCollectionItem(item: JsonRecord): boolean {
  if (item.uncollected === true || item.is_delivery === true) return false;
  const action = text(item.service_action)?.toLowerCase();
  const type = text(item.type)?.toLowerCase();
  return action !== 'delivery' && type !== 'delivery';
}

function itemMaterial(item: JsonRecord): string | null {
  return text(item.waste_stream)
    || text(item.waste_stream_name)
    || text(item.container)
    || text(item.container_name)
    || text(item.product_name);
}

function itemQuantity(item: JsonRecord): number {
  return Math.max(0, number(item.actual_quantity ?? item.quantity));
}

function recordedWeight(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

interface WeightReading {
  value: number;
  estimated: boolean;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1
    || (typeof value === 'string' && ['true', '1', 'yes'].includes(value.trim().toLowerCase()));
}

function itemWeight(item: JsonRecord): WeightReading | null {
  const confirmedWeight = recordedWeight(
    item.actual_weight_kg,
    item.physical_uplift_weight_kg,
  );
  if (confirmedWeight !== null) {
    return { value: confirmedWeight, estimated: isTrue(item.weight_estimated) };
  }

  const otherWeight = recordedWeight(item.total_weight, item.weight);
  const hasWeightEvidence = otherWeight !== null && (
    otherWeight > 0
      || isTrue(item.weight_estimated)
      || isTrue(item.weight_office_confirmed)
      || Boolean(text(item.weight_confirmed_at))
  );
  return hasWeightEvidence
    ? { value: otherWeight, estimated: isTrue(item.weight_estimated) }
    : null;
}

function plannedItemWeight(item: JsonRecord): WeightReading | null {
  const derivedWeight = number(item.weight_per_unit) * itemQuantity(item);
  const value = recordedWeight(
    derivedWeight > 0 ? derivedWeight : null,
    item.total_weight,
    item.weight,
  );
  return value !== null && value > 0 ? { value, estimated: true } : null;
}

function collectionWeight(collectionData: JsonRecord): WeightReading | null {
  const actualWeight = recordedWeight(collectionData.actual_weight);
  if (actualWeight !== null) {
    return { value: actualWeight, estimated: isTrue(collectionData.weight_estimated) };
  }

  const totalWeight = recordedWeight(collectionData.total_weight);
  if (totalWeight === null || (totalWeight === 0 && !isTrue(collectionData.weighed))) {
    return null;
  }
  return {
    value: totalWeight,
    estimated: isTrue(collectionData.weight_pending) || !isTrue(collectionData.weighed),
  };
}

function completionDate(value: unknown): string | null {
  const normalized = text(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

const SURCHARGE_EXEMPT_COLLECTION_TYPES = new Set([
  'drop_in',
  'drop-in',
  'misc_charge',
  'charge_only',
  'charge-only',
]);

function appliesToCollectionDate(
  surcharge: PortalReportSourceSurcharge,
  completedAt: string,
): boolean {
  const effectiveFrom = text(surcharge.effective_from);
  if (!effectiveFrom) return true;
  return effectiveFrom.slice(0, 10) <= completedAt.slice(0, 10);
}

function serviceRequestFallbackCost(
  request: PortalReportSourceServiceRequest,
  surcharges: PortalReportSourceSurcharge[],
  completedAt: string,
): number {
  const metadata = jsonObject(request.metadata);
  const fixedPriceTotal = Math.max(0, number(metadata.fixed_price_total));
  const itemTotal = (request.items || []).reduce((sum, item) => {
    const containerData = jsonObject(item.container_data);
    const pricingPackageData = jsonObject(item.pricing_package_data);
    const billingType = (text(containerData.billing_type) || text(item.billing_type) || '').toUpperCase();
    if (item.is_chargeable === false || ['FOC', 'R'].includes(billingType)) return sum;
    if (isTrue(pricingPackageData.is_prepaid) && number(item.total_price) <= 0) return sum;

    const storedTotal = recordedWeight(item.total_price, item.base_price);
    if (storedTotal !== null && storedTotal > 0) return sum + storedTotal;

    const manualPrice = Math.max(0, number(item.manual_price));
    const quantity = Math.max(1, number(item.manual_quantity ?? item.quantity));
    return sum + (manualPrice * quantity);
  }, 0);
  const explicitCharges = [
    request.collection_charge,
    request.delivery_charge,
    request.postage_cost,
  ].reduce<number>((sum, value) => sum + Math.max(0, number(value)), 0);
  const baseCost = fixedPriceTotal > 0
    ? fixedPriceTotal
    : itemTotal + explicitCharges;

  const collectionType = text(metadata.collection_type)?.toLowerCase();
  if (baseCost <= 0 || (collectionType && SURCHARGE_EXEMPT_COLLECTION_TYPES.has(collectionType))) {
    return roundMoney(baseCost);
  }

  let surchargeTotal = 0;
  for (const surcharge of surcharges) {
    if (!appliesToCollectionDate(surcharge, completedAt)) continue;
    const value = Math.max(0, number(surcharge.value));
    const type = text(surcharge.surcharge_type)?.toLowerCase();
    if (type === 'fixed') surchargeTotal += value;
    if (type === 'percentage') surchargeTotal += baseCost * value / 100;
  }
  return roundMoney(baseCost + surchargeTotal);
}

function serviceRequestHasRaisedInvoice(request: PortalReportSourceServiceRequest): boolean {
  const metadata = jsonObject(request.metadata);
  return isTrue(metadata.invoice_raised)
    || Boolean(text(metadata.invoice_id))
    || Boolean(text(metadata.invoice_number));
}

interface ServiceRequestWeightEstimate {
  totalKg: number;
  byMaterial: Map<string, number>;
}

function firstPositiveNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = number(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function serviceRequestWeightEstimate(
  request: PortalReportSourceServiceRequest,
): ServiceRequestWeightEstimate {
  const byMaterial = new Map<string, number>();
  let totalKg = 0;

  for (const item of request.items || []) {
    const containerData = jsonObject(item.container_data);
    if (isTrue(item.is_delivery) || isTrue(containerData.is_delivery)) continue;

    const quantity = Math.max(1, number(item.manual_quantity ?? item.quantity));
    const perUnitKg = firstPositiveNumber(
      containerData.contents_when_filled,
      containerData.estimated_filled_weight,
      containerData.capacity,
    );
    const estimateKg = firstPositiveNumber(item.total_weight, perUnitKg * quantity);
    if (estimateKg <= 0) continue;

    const wasteStreamData = jsonObject(item.waste_stream_data);
    const material = text(wasteStreamData.name)
      || text(containerData.name)
      || text(containerData.container_name)
      || 'Unspecified material';
    totalKg += estimateKg;
    byMaterial.set(material, (byMaterial.get(material) || 0) + estimateKg);
  }

  return { totalKg: roundWeight(totalKg), byMaterial };
}

export function buildPortalReport(
  stops: PortalReportSourceStop[],
  pricing: PortalReportPricingContext = {},
): PortalReport {
  const serviceRequests = new Map(
    (pricing.serviceRequests || []).map((request) => [String(request.id), request]),
  );
  const surcharges = pricing.surcharges || [];
  const grouped = new Map<string, {
    id: string;
    date: string;
    reference: string;
    materials: Set<string>;
    quantity: number;
    weightKg: number;
    weightPending: boolean;
    weightEstimated: boolean;
    costExVat: number;
    fallbackCostExVat: number;
    costPending: boolean;
    hasRaisedInvoice: boolean;
    fallbackWeightKg: number;
    fallbackWeightByMaterial: Map<string, number>;
    waste: Map<string, {
      quantity: number;
      weightKg: number;
      weightPending: boolean;
      weightEstimated: boolean;
    }>;
  }>();

  for (const stop of stops) {
    if (text(stop.status)?.toLowerCase() !== 'completed') continue;
    const stopType = text(stop.stop_type)?.toLowerCase();
    if (stopType && stopType !== 'collection') continue;

    const completedAt = completionDate(stop.completed_at);
    if (!completedAt) continue;

    const collectionData = jsonObject(stop.collection_data);
    const financialData = jsonObject(stop.financial_data);
    const serviceRequestId = text(stop.service_request_id);
    const groupKey = serviceRequestId ? `service:${serviceRequestId}` : `stop:${stop.id}`;
    const reference = text(collectionData.service_request_reference)
      || text(collectionData.order_number)
      || `Collection ${stop.id}`;
    const actualItems = jsonArray(stop.actual_items).filter(isCollectionItem);
    const displayItems = actualItems.length > 0
      ? actualItems
      : jsonArray(stop.planned_items).filter(isCollectionItem);
    const actualItemWeights = actualItems.map(itemWeight);
    const availableActualWeights = actualItemWeights.filter(
      (reading): reading is WeightReading => reading !== null,
    );
    const fallbackWeight = collectionWeight(collectionData);
    const plannedItems = jsonArray(stop.planned_items).filter(isCollectionItem);
    const plannedWeights = plannedItems.map(plannedItemWeight);
    const availablePlannedWeights = plannedWeights.filter(
      (reading): reading is WeightReading => reading !== null,
    );

    let stopWeight: WeightReading | null = null;
    let stopWeightPending = false;
    if (actualItems.length > 0 && availableActualWeights.length > 0) {
      stopWeight = {
        value: availableActualWeights.reduce((sum, reading) => sum + reading.value, 0),
        estimated: availableActualWeights.some((reading) => reading.estimated),
      };
      stopWeightPending = availableActualWeights.length < actualItems.length;
    } else if (fallbackWeight) {
      stopWeight = fallbackWeight;
    } else if (availablePlannedWeights.length > 0) {
      stopWeight = {
        value: availablePlannedWeights.reduce((sum, reading) => sum + reading.value, 0),
        estimated: true,
      };
      stopWeightPending = availablePlannedWeights.length < plannedItems.length;
    } else {
      stopWeightPending = true;
    }

    let group = grouped.get(groupKey);
    if (!group) {
      group = {
        id: groupKey,
        date: completedAt,
        reference,
        materials: new Set(),
        quantity: 0,
        weightKg: 0,
        weightPending: false,
        weightEstimated: false,
        costExVat: 0,
        fallbackCostExVat: 0,
        costPending: false,
        hasRaisedInvoice: false,
        fallbackWeightKg: 0,
        fallbackWeightByMaterial: new Map(),
        waste: new Map(),
      };
      grouped.set(groupKey, group);
    }

    if (completedAt > group.date) group.date = completedAt;
    if (group.reference.startsWith('Collection ') && !reference.startsWith('Collection ')) {
      group.reference = reference;
    }
    group.costExVat += number(financialData.revenue);
    const serviceRequest = serviceRequestId
      ? serviceRequests.get(serviceRequestId)
      : undefined;
    if (serviceRequest) {
      const weightEstimate = serviceRequestWeightEstimate(serviceRequest);
      group.fallbackWeightKg = Math.max(group.fallbackWeightKg, weightEstimate.totalKg);
      for (const [material, estimateKg] of weightEstimate.byMaterial) {
        group.fallbackWeightByMaterial.set(
          material,
          Math.max(group.fallbackWeightByMaterial.get(material) || 0, estimateKg),
        );
      }
      const hasRaisedInvoice = serviceRequestHasRaisedInvoice(serviceRequest);
      group.costPending = group.costPending || !hasRaisedInvoice;
      group.hasRaisedInvoice = group.hasRaisedInvoice || hasRaisedInvoice;
      if (hasRaisedInvoice) {
        group.fallbackCostExVat = Math.max(
          group.fallbackCostExVat,
          serviceRequestFallbackCost(serviceRequest, surcharges, completedAt),
        );
      }
    }
    group.weightKg += stopWeight?.value ?? 0;
    group.weightPending = group.weightPending || stopWeightPending;
    group.weightEstimated = group.weightEstimated || Boolean(stopWeight?.estimated);

    for (const item of displayItems) {
      const material = itemMaterial(item) || 'Unspecified material';
      const quantity = itemQuantity(item);
      const itemReading = actualItems.includes(item)
        ? itemWeight(item)
        : plannedItemWeight(item);
      const weightReading = itemReading
        || (displayItems.length === 1 ? stopWeight : null);
      group.materials.add(material);
      group.quantity += quantity;

      const waste = group.waste.get(material) || {
        quantity: 0,
        weightKg: 0,
        weightPending: false,
        weightEstimated: false,
      };
      waste.quantity += quantity;
      waste.weightKg += weightReading?.value ?? 0;
      waste.weightPending = waste.weightPending
        || weightReading === null
        || (displayItems.length === 1 && stopWeightPending);
      waste.weightEstimated = waste.weightEstimated || Boolean(weightReading?.estimated);
      group.waste.set(material, waste);
    }
  }

  for (const group of grouped.values()) {
    if (!group.weightPending || group.weightKg > 0 || group.fallbackWeightKg <= 0) continue;

    group.weightKg = group.fallbackWeightKg;
    group.weightPending = false;
    group.weightEstimated = true;

    let assignedWeightKg = 0;
    for (const [material, estimateKg] of group.fallbackWeightByMaterial) {
      const wasteEntry = [...group.waste.entries()].find(
        ([name]) => name.trim().toLowerCase() === material.trim().toLowerCase(),
      );
      if (!wasteEntry) continue;
      const [, waste] = wasteEntry;
      waste.weightKg = estimateKg;
      waste.weightPending = false;
      waste.weightEstimated = true;
      assignedWeightKg += estimateKg;
    }

    if (assignedWeightKg === 0 && group.waste.size === 1) {
      const waste = group.waste.values().next().value;
      if (waste) {
        waste.weightKg = group.fallbackWeightKg;
        waste.weightPending = false;
        waste.weightEstimated = true;
      }
    }
  }

  const collections = [...grouped.values()]
    .map<PortalReportCollection>((group) => ({
      id: group.id,
      date: group.date,
      reference: group.reference,
      materials: [...group.materials].sort((left, right) => left.localeCompare(right)),
      quantity: roundWeight(group.quantity),
      weightKg: roundWeight(group.weightKg),
      weightPending: group.weightPending,
      weightEstimated: group.weightEstimated,
      costExVat: roundMoney(
        group.costPending
          ? 0
          : group.hasRaisedInvoice && group.fallbackCostExVat > 0
            ? group.fallbackCostExVat
            : group.costExVat,
      ),
      costPending: group.costPending,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));

  const monthMap = new Map<string, {
    collections: number;
    costExVat: number;
    weightKg: number;
    pendingWeightCollections: number;
    estimatedWeightCollections: number;
    pendingCostCollections: number;
  }>();
  const wasteMap = new Map<string, {
    collections: Set<string>;
    pendingWeightCollections: Set<string>;
    estimatedWeightCollections: Set<string>;
    quantity: number;
    weightKg: number;
  }>();

  for (const collection of collections) {
    const month = collection.date.slice(0, 7);
    const monthly = monthMap.get(month) || {
      collections: 0,
      costExVat: 0,
      weightKg: 0,
      pendingWeightCollections: 0,
      estimatedWeightCollections: 0,
      pendingCostCollections: 0,
    };
    monthly.collections += 1;
    monthly.costExVat += collection.costExVat;
    monthly.weightKg += collection.weightKg;
    if (collection.weightPending) monthly.pendingWeightCollections += 1;
    if (collection.weightEstimated) monthly.estimatedWeightCollections += 1;
    if (collection.costPending) monthly.pendingCostCollections += 1;
    monthMap.set(month, monthly);

    const source = grouped.get(collection.id);
    for (const [name, values] of source?.waste || []) {
      const waste = wasteMap.get(name) || {
        collections: new Set<string>(),
        pendingWeightCollections: new Set<string>(),
        estimatedWeightCollections: new Set<string>(),
        quantity: 0,
        weightKg: 0,
      };
      waste.collections.add(collection.id);
      if (values.weightPending) waste.pendingWeightCollections.add(collection.id);
      if (values.weightEstimated) waste.estimatedWeightCollections.add(collection.id);
      waste.quantity += values.quantity;
      waste.weightKg += values.weightKg;
      wasteMap.set(name, waste);
    }
  }

  const totalCostExVat = collections.reduce((sum, row) => sum + row.costExVat, 0);
  const totalWeightKg = collections.reduce((sum, row) => sum + row.weightKg, 0);
  const pendingCostCollections = collections.filter((collection) => collection.costPending).length;
  const invoicedCollections = collections.length - pendingCostCollections;

  return {
    summary: {
      collections: collections.length,
      totalCostExVat: roundMoney(totalCostExVat),
      totalWeightKg: roundWeight(totalWeightKg),
      pendingWeightCollections: collections.filter((collection) => collection.weightPending).length,
      estimatedWeightCollections: collections.filter((collection) => collection.weightEstimated).length,
      pendingCostCollections,
      averageCostExVat: invoicedCollections > 0
        ? roundMoney(totalCostExVat / invoicedCollections)
        : 0,
    },
    monthly: [...monthMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => ({
        month,
        label: monthLabel(month),
        collections: values.collections,
        costExVat: roundMoney(values.costExVat),
        weightKg: roundWeight(values.weightKg),
        pendingWeightCollections: values.pendingWeightCollections,
        estimatedWeightCollections: values.estimatedWeightCollections,
        pendingCostCollections: values.pendingCostCollections,
      })),
    wasteStreams: [...wasteMap.entries()]
      .map(([name, values]) => ({
        name,
        collections: values.collections.size,
        quantity: roundWeight(values.quantity),
        weightKg: roundWeight(values.weightKg),
        pendingWeightCollections: values.pendingWeightCollections.size,
        estimatedWeightCollections: values.estimatedWeightCollections.size,
      }))
      .sort((left, right) => right.weightKg - left.weightKg || right.quantity - left.quantity),
    collections,
  };
}
