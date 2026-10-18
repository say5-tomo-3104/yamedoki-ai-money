// 4人の累積年金手取り額と思い出スコアを比べる横棒グラフ（SPEC.md 第9章-2）
function BarPanel({ title, unit, rows, valueKey }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]))
  return (
    <div className="chart-panel">
      <h4 className="chart-title">{title}</h4>
      <ul className="chart-rows">
        {rows.map((r) => {
          const v = r[valueKey]
          const pct = (v / max) * 100
          return (
            <li key={r.id} className={`chart-row${r.isPlayer ? ' is-player' : ''}`}>
              <span className="chart-label">
                {r.name}
                <small>{r.pensionAge}歳受給</small>
              </span>
              <span className="chart-track" title={`${r.name}：${v.toLocaleString()}${unit}${r.present ? '' : '（他界）'}`}>
                <span className="chart-bar" style={{ width: `${Math.max(pct, 0.5)}%` }} />
              </span>
              <span className="chart-value">
                {v.toLocaleString()}
                <small>{unit}</small>
                {!r.present && <em className="chart-absent">欠席</em>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function CompareChart({ rows, age }) {
  return (
    <section className="chart" aria-label={`${age}歳時点の比較`}>
      <BarPanel title={`${age}歳までの累積年金（手取り）`} unit="万円" rows={rows} valueKey="cum" />
      <BarPanel title="思い出スコア（心の充実度）" unit="pt" rows={rows} valueKey="heart" />
    </section>
  )
}
