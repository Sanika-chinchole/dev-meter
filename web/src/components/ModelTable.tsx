import { formatCount, formatUsd, formatUsdExact } from '../format'
import type { UsageModel } from '../usage'
import { costShare, isUnpriced, sortByCost } from '../usageView'

/** Spend per model, highest cost first. The thin bar shows each model's share of the total. */
export default function ModelTable({ models, totalCostUsd }: { models: UsageModel[]; totalCostUsd: number }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Spend per model, highest cost first</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col" className="num">Calls</th>
            <th scope="col" className="num">Input tokens</th>
            <th scope="col" className="num">Output tokens</th>
            <th scope="col" className="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          {sortByCost(models).map((model) => {
            const share = costShare(model, totalCostUsd)
            return (
              <tr key={model.model}>
                <td>
                  <span className="model-name">{model.model}</span>
                  {isUnpriced(model) && (
                    <span className="badge" title="DevMeter has no price for this model yet, so its calls are recorded as $0.">
                      unpriced
                    </span>
                  )}
                </td>
                <td className="num">{formatCount(model.calls)}</td>
                <td className="num">{formatCount(model.inputTokens)}</td>
                <td className="num">{formatCount(model.outputTokens)}</td>
                <td className="num cost-cell" title={`${formatUsdExact(model.costUsd)} · ${Math.round(share * 100)}% of total`}>
                  {formatUsd(model.costUsd)}
                  <span className="share-track" aria-hidden="true">
                    <span className="share-bar" style={{ width: `${share * 100}%` }} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
