import { RANGE_PRESETS, type RangeDays } from '../range'

/** 7 / 30 / 90-day presets. Sits in one row above everything it filters. */
export default function RangePicker({ value, onChange }: { value: RangeDays; onChange(days: RangeDays): void }) {
  return (
    <div className="segmented" role="group" aria-label="Date range">
      {RANGE_PRESETS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={days === value}
          className={days === value ? 'active' : undefined}
          onClick={() => onChange(days)}
        >
          {days} days
        </button>
      ))}
    </div>
  )
}
