import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCount, formatDate, formatShortDate, formatUsd, formatUsdExact, formatUsdTick } from '../format'
import type { UsageDay } from '../usage'
import { daysWithCalls } from '../usageView'

/** Spend per day: one bar per calendar day. Days without calls sit flat on the baseline (no gaps). */
export default function DailyCostChart({ days }: { days: UsageDay[] }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <>
      <div className="daily-chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={formatUsdTick} tickLine={false} axisLine={false} width={64} allowDecimals />
            <Tooltip content={<DayTooltip />} isAnimationActive={false} />
            <Bar dataKey="costUsd" className="cost-bar" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <button type="button" className="link-button table-toggle" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Hide table' : 'Show as table'}
      </button>
      {showTable && <DayTable days={daysWithCalls(days)} />}
    </>
  )
}

interface DayTooltipProps {
  active?: boolean
  payload?: { payload: UsageDay }[]
}

function DayTooltip({ active, payload }: DayTooltipProps) {
  const day = active ? payload?.[0]?.payload : undefined
  if (!day) {
    return null
  }
  return (
    <div className="chart-tooltip">
      <strong>{formatUsd(day.costUsd)}</strong>
      <span className="muted"> {formatUsdExact(day.costUsd)}</span>
      <div>{formatDate(day.date)}</div>
      <div className="muted">
        {formatCount(day.calls)} {day.calls === 1 ? 'call' : 'calls'} · {formatCount(day.inputTokens)} in / {formatCount(day.outputTokens)} out tokens
      </div>
    </div>
  )
}

function DayTable({ days }: { days: UsageDay[] }) {
  if (days.length === 0) {
    return <p className="muted">No calls in this range.</p>
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Spend per day (days with calls)</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" className="num">Calls</th>
            <th scope="col" className="num">Input tokens</th>
            <th scope="col" className="num">Output tokens</th>
            <th scope="col" className="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatDate(day.date)}</td>
              <td className="num">{formatCount(day.calls)}</td>
              <td className="num">{formatCount(day.inputTokens)}</td>
              <td className="num">{formatCount(day.outputTokens)}</td>
              <td className="num" title={formatUsdExact(day.costUsd)}>{formatUsd(day.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
