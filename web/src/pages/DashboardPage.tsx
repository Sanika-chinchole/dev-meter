import { useSearchParams } from 'react-router-dom'
import DailyCostChart from '../components/DailyCostChart'
import ModelTable from '../components/ModelTable'
import RangePicker from '../components/RangePicker'
import { formatCount, formatDate, formatUsd, formatUsdExact } from '../format'
import { localToday, parseRange, rangeDates, type RangeDays } from '../range'
import { useUsage } from '../useUsage'
import { unpricedCount } from '../usageView'

/** Signed-in only (see RequireAuth). The range lives in the URL (?range=7) so refresh and links keep it. */
export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseRange(searchParams.get('range'))
  const { from, to } = rangeDates(range, localToday())
  const { loading, report, usedFallbackTz, error, retry } = useUsage(from, to)

  const setRange = (days: RangeDays) => setSearchParams({ range: String(days) }, { replace: true })

  if (error && !report) {
    return (
      <section className="card narrow">
        <h1>Can't load your usage</h1>
        <p className="muted">{error}</p>
        <button type="button" className="button" onClick={retry}>Try again</button>
      </section>
    )
  }

  const unpriced = report ? unpricedCount(report.byModel) : 0
  const empty = report !== undefined && report.totalCalls === 0
  return (
    <>
      <div className="toolbar">
        <h1>Your AI spend</h1>
        <div className="toolbar-actions">
          <button type="button" className="button secondary" onClick={retry} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <RangePicker value={range} onChange={setRange} />
        </div>
      </div>
      <p className="muted range">
        {report ? `${formatDate(report.from)} – ${formatDate(report.to)} · ${report.tz}` : `Last ${range} days`}
        {loading && report && ' · updating…'}
      </p>
      {usedFallbackTz && (
        <p className="notice">Days are shown in UTC because the backend didn't accept your browser's time zone.</p>
      )}
      {error && report && (
        <p className="notice" role="alert">
          Couldn't refresh: {error} <button type="button" className="link-button" onClick={retry}>Try again</button>
        </p>
      )}

      <div className={loading && report ? 'stale' : undefined}>
        <div className="grid stats">
          <section className="card">
            <h2>Total cost</h2>
            <p className="stat" title={report ? formatUsdExact(report.totalCostUsd) : undefined}>
              {report ? formatUsd(report.totalCostUsd) : 'Loading…'}
            </p>
            {unpriced > 0 && (
              <p className="muted small">Excludes {unpriced} unpriced {unpriced === 1 ? 'model' : 'models'}</p>
            )}
          </section>
          <section className="card">
            <h2>Calls</h2>
            <p className="stat">{report ? formatCount(report.totalCalls) : 'Loading…'}</p>
          </section>
        </div>

        {empty ? (
          <section className="card empty">
            <h2>No usage yet</h2>
            <p className="muted">
              No AI calls in the last {range} days. Use <strong>DevMeter: Ask AI</strong> in VS Code and they will show up here.
            </p>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>Spend by day</h2>
              {report ? <DailyCostChart days={report.byDay} /> : <p className="muted">Loading…</p>}
            </section>
            <section className="card">
              <h2>Spend by model</h2>
              {report ? <ModelTable models={report.byModel} totalCostUsd={report.totalCostUsd} /> : <p className="muted">Loading…</p>}
            </section>
          </>
        )}
      </div>
    </>
  )
}
