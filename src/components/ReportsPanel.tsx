'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileBarChart,
  Loader2,
  PackageCheck,
  PoundSterling,
  Scale,
  TrendingUp,
} from 'lucide-react';

interface ReportCollection {
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

interface ReportResponse {
  range: { from: string; to: string };
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
  collections: ReportCollection[];
}

interface ReportsPanelProps {
  accountReference: string;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function initialRange(days = 90) {
  const to = new Date();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

function weight(value: number): string {
  if (value >= 1_000) {
    return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value / 1_000)} t`;
  }
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value)} kg`;
}

function reportedWeight(
  value: number,
  pending: boolean,
  estimated: boolean,
): string {
  if (pending && value === 0) return 'Pending';
  const recorded = `${weight(value)}${estimated ? '*' : ''}`;
  return pending ? `${recorded} + pending` : recorded;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function csvCell(value: string | number): string {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
}

export default function ReportsPanel({ accountReference }: ReportsPanelProps) {
  const defaultRange = useMemo(() => initialRange(), []);
  const [draftRange, setDraftRange] = useState(defaultRange);
  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!accountReference) {
      setLoading(false);
      setError('This account does not have a reporting reference.');
      return;
    }

    const controller = new AbortController();
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      setShowAll(false);

      try {
        const params = new URLSearchParams({
          ref: accountReference,
          from: range.from,
          to: range.to,
        });
        const response = await fetch(`/api/reports?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load report');
        setReport(data as ReportResponse);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setReport(null);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load report');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchReport();
    return () => controller.abort();
  }, [accountReference, range]);

  const applyPreset = (days: number) => {
    const nextRange = initialRange(days);
    setDraftRange(nextRange);
    setRange(nextRange);
  };

  const applyYearToDate = () => {
    const now = new Date();
    const nextRange = {
      from: `${now.getUTCFullYear()}-01-01`,
      to: isoDay(now),
    };
    setDraftRange(nextRange);
    setRange(nextRange);
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Collection date', 'Reference', 'Materials', 'Quantity', 'Weight', 'Cost ex VAT (GBP)'],
      ...report.collections.map((collection) => [
        collection.date.slice(0, 10),
        collection.reference,
        collection.materials.join('; '),
        collection.quantity,
        reportedWeight(collection.weightKg, collection.weightPending, collection.weightEstimated),
        collection.costPending ? 'Pending' : collection.costExVat.toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `collection-report-${report.range.from}-to-${report.range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const maxMonthlyCost = Math.max(...(report?.monthly.map((month) => month.costExVat) || [0]));
  const visibleCollections = showAll
    ? report?.collections || []
    : report?.collections.slice(0, 50) || [];
  const allWeightsPending = Boolean(
    report
      && report.summary.collections > 0
      && report.summary.pendingWeightCollections === report.summary.collections
      && report.summary.totalWeightKg === 0,
  );
  const allCostsPending = Boolean(
    report
      && report.summary.collections > 0
      && report.summary.pendingCostCollections === report.summary.collections,
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <FileBarChart size={19} className="text-[var(--color-primary)]" />
              Collection reporting
            </h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Review completed collections, weights and service costs for any period.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => applyPreset(30)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200">30 days</button>
            <button onClick={() => applyPreset(90)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200">90 days</button>
            <button onClick={() => applyPreset(365)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200">12 months</button>
            <button onClick={applyYearToDate} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200">This year</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-medium text-gray-600">
            From
            <input
              type="date"
              value={draftRange.from}
              max={draftRange.to}
              onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            To
            <input
              type="date"
              value={draftRange.to}
              min={draftRange.from}
              onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <button
            onClick={() => setRange(draftRange)}
            disabled={!draftRange.from || !draftRange.to || draftRange.from > draftRange.to || loading}
            className="self-end rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply dates
          </button>
        </div>
      </section>

      {loading ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
          <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
          <p className="mt-3 text-sm text-gray-500">Building your collection report...</p>
        </section>
      ) : error ? (
        <section className="rounded-xl border border-red-100 bg-red-50 p-6 text-center sm:rounded-2xl">
          <p className="font-medium text-red-900">Unable to load reporting</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </section>
      ) : report && report.summary.collections === 0 ? (
        <section className="rounded-xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm sm:rounded-2xl">
          <CalendarDays size={34} className="mx-auto text-gray-300" />
          <p className="mt-4 font-medium text-gray-900">No completed collections in this period</p>
          <p className="mt-1 text-sm text-gray-500">Try widening the date range.</p>
        </section>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Collections', value: report.summary.collections.toLocaleString('en-GB'), icon: PackageCheck, colour: 'bg-emerald-50 text-emerald-700' },
              {
                label: 'Total weight',
                value: allWeightsPending
                  ? 'Pending'
                  : `${weight(report.summary.totalWeightKg)}${report.summary.estimatedWeightCollections > 0 ? '*' : ''}`,
                detail: [
                  report.summary.estimatedWeightCollections > 0
                    ? `${report.summary.estimatedWeightCollections} estimated`
                    : null,
                  report.summary.pendingWeightCollections > 0
                    ? `${report.summary.pendingWeightCollections} pending`
                    : null,
                ].filter(Boolean).join(' · ') || undefined,
                icon: Scale,
                colour: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Service cost',
                value: allCostsPending ? 'Pending' : currency(report.summary.totalCostExVat),
                detail: report.summary.pendingCostCollections > 0
                  ? `${report.summary.pendingCostCollections} pending invoice${report.summary.pendingCostCollections === 1 ? '' : 's'}`
                  : undefined,
                icon: PoundSterling,
                colour: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Average cost',
                value: allCostsPending ? 'Pending' : currency(report.summary.averageCostExVat),
                detail: report.summary.pendingCostCollections > 0 && !allCostsPending
                  ? 'Invoiced collections only'
                  : undefined,
                icon: TrendingUp,
                colour: 'bg-purple-50 text-purple-700',
              },
            ].map(({ label, value, detail, icon: Icon, colour }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:rounded-2xl">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colour}`}><Icon size={18} /></div>
                <p className="mt-3 text-xs font-medium text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{value}</p>
                {detail && <p className="mt-1 text-[11px] text-amber-600">{detail}</p>}
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-gray-900">Cost over time</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">Monthly service cost excluding VAT</p>
            <div className="mt-5 space-y-3">
              {report.monthly.map((month) => (
                <div key={month.month} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[90px_1fr_auto] sm:text-sm">
                  <span className="font-medium text-gray-600">{month.label}</span>
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="h-8 min-w-0 flex-1 overflow-hidden rounded-lg bg-gray-100">
                      <div
                        className="h-full rounded-lg bg-[var(--color-primary)] transition-[width]"
                        style={{ width: `${maxMonthlyCost > 0 ? Math.max(5, (month.costExVat / maxMonthlyCost) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-medium text-gray-600 sm:text-xs">
                      {month.collections} collection{month.collections === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className={`min-w-20 text-right font-semibold ${month.pendingCostCollections === month.collections ? 'text-amber-700' : 'text-gray-900'}`}>
                    {month.pendingCostCollections === month.collections
                      ? 'Pending'
                      : currency(month.costExVat)}
                    {month.pendingCostCollections > 0 && month.pendingCostCollections < month.collections && (
                      <span className="block text-[10px] font-medium text-amber-600">
                        {month.pendingCostCollections} pending
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {report.wasteStreams.length > 0 && (
            <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
              <h3 className="font-semibold text-gray-900">Materials collected</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="pb-3 font-medium">Material</th>
                      <th className="pb-3 text-right font-medium">Collections</th>
                      <th className="pb-3 text-right font-medium">Quantity</th>
                      <th className="pb-3 text-right font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.wasteStreams.map((stream) => (
                      <tr key={stream.name}>
                        <td className="py-3 font-medium text-gray-800">{stream.name}</td>
                        <td className="py-3 text-right text-gray-600">{stream.collections}</td>
                        <td className="py-3 text-right text-gray-600">{stream.quantity.toLocaleString('en-GB')}</td>
                        <td className="py-3 text-right text-gray-600">
                          <span className={stream.pendingWeightCollections === stream.collections ? 'font-medium text-amber-600' : ''}>
                            {reportedWeight(
                              stream.weightKg,
                              stream.pendingWeightCollections > 0,
                              stream.estimatedWeightCollections > 0,
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm sm:rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="font-semibold text-gray-900">Collection history</h3>
                <p className="mt-0.5 text-xs text-gray-500">{report.range.from} to {report.range.to}</p>
              </div>
              <button
                onClick={exportCsv}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium sm:px-6">Date</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Materials</th>
                    <th className="px-4 py-3 text-right font-medium">Quantity</th>
                    <th className="px-4 py-3 text-right font-medium">Weight</th>
                    <th className="px-4 py-3 text-right font-medium sm:pr-6">Cost ex VAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleCollections.map((collection) => (
                    <tr key={collection.id} className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700 sm:px-6">{displayDate(collection.date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{collection.reference}</td>
                      <td className="max-w-72 px-4 py-3 text-gray-600">{collection.materials.join(', ') || 'Collection'}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{collection.quantity.toLocaleString('en-GB')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">
                        {collection.weightPending && collection.weightKg === 0 ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending</span>
                        ) : (
                          reportedWeight(
                            collection.weightKg,
                            collection.weightPending,
                            collection.weightEstimated,
                          )
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900 sm:pr-6">
                        {collection.costPending ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pending</span>
                        ) : (
                          currency(collection.costExVat)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && report.collections.length > 50 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full border-t border-gray-100 px-4 py-3 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
              >
                Show all {report.collections.length} collections
              </button>
            )}
          </section>

          <p className="px-1 text-xs leading-relaxed text-gray-400">
            * Includes estimated weight. Weight is pending when it has not been recorded. Costs appear once the invoice is raised and exclude VAT; pending or approved invoices are shown as Pending.
          </p>
        </>
      ) : null}
    </div>
  );
}
