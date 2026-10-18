import { getProfile, totalAssets } from '../engine/engine.js'

// 常時表示ヘッダー（SPEC.md 第9章-1）
export default function Header({ state }) {
  const { region, gender } = getProfile(state)
  const health = Math.round(state.health)
  const assets = Math.round(totalAssets(state))
  const invest = Math.round(state.invest || 0)
  return (
    <header className="hud">
      <div className="hud-age">
        <span className="hud-num">{state.age}</span>
        <span className="hud-unit">歳</span>
      </div>
      <dl className="hud-stats">
        <div>
          <dt>居住地・性別</dt>
          <dd>{region.name}・{gender === 'male' ? '男性' : '女性'}</dd>
        </div>
        <div>
          <dt>年金受給</dt>
          <dd>{state.pensionAge ? `${state.pensionAge}歳から` : '未決定'}</dd>
        </div>
        <div>
          <dt>資産</dt>
          <dd className={assets < 0 ? 'is-minus' : ''}>{assets.toLocaleString()}<small>万円{invest > 0 && `（うちNISA ${invest.toLocaleString()}）`}</small></dd>
        </div>
        <div>
          <dt>身体{state.flags.mobilityLimited ? '（要支援）' : ''}</dt>
          <dd>
            <span className="hud-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health} aria-label="健康値">
              <span style={{ width: `${health}%` }} className={health < 40 ? 'is-low' : ''} />
            </span>
            <small>{health}</small>
          </dd>
        </div>
        <div>
          <dt>心（思い出）</dt>
          <dd>{Math.round(state.heart)}<small>pt<span className="hud-extra"> / 思い出資産 {state.memory}</span></small></dd>
        </div>
      </dl>
    </header>
  )
}
