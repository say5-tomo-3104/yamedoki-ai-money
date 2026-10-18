import { useEffect, useState } from 'react'
import { CHAPTERS, EVENTS } from '../data/events.js'
import { PENSION_TABLE } from '../data/tables.js'
import { NPC_DATA } from '../data/npcs.js'
import {
  getProfile, eventContext, choiceAvailability, compareAt, getReunion, totalAssets,
} from '../engine/engine.js'
import Illustration from './Illustration.jsx'
import CompareChart from './CompareChart.jsx'

const sign = (v) => (v > 0 ? `+${v}` : `${v}`)

function Deltas({ deltas }) {
  const items = [
    ['現金', Math.round(deltas.assets), '万'],
    ['NISA', Math.round(deltas.invest || 0), '万'],
    ['健康', Math.round(deltas.health), ''],
    ['心', Math.round(deltas.heart), ''],
    ['思い出', deltas.memory, ''],
  ].filter(([, v]) => v)
  if (!items.length) return null
  return (
    <ul className="deltas">
      {items.map(([k, v, u]) => (
        <li key={k} className={v > 0 ? 'is-up' : 'is-down'}>{k} {sign(v)}{u}</li>
      ))}
    </ul>
  )
}

// ---- タイトル ----
export function TitleScreen({ hasSave, shelfCount, onNew, onContinue, onShelf }) {
  return (
    <main className="screen title-screen">
      <Illustration imageId="img_start_50" title="黄金の夕暮れと同窓会" />
      <h1 className="game-title">黄金の夕暮れと同窓会<small>（仮）</small></h1>
      <p className="lead">
        五十歳から八十五歳まで、あなたの後半生を生きる。<br />
        年金をいつから受け取るか。その選択の光と影を、三人の同級生と見比べながら。
      </p>
      <ul className="feature-list">
        <li>税金・社会保険料を引いた<strong>「手取り」</strong>で損益分岐点を計算</li>
        <li>62・73・82歳の<strong>同窓会</strong>で、選ばなかった人生と答え合わせ</li>
        <li>エンディングで<strong>一編の短編小説</strong>が生まれる</li>
      </ul>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onNew}>人生ガチャを回す</button>
        {hasSave && <button type="button" className="btn" onClick={onContinue}>続きから</button>}
        {shelfCount > 0 && <button type="button" className="btn ghost" onClick={onShelf}>本棚（{shelfCount}冊）</button>}
      </div>
    </main>
  )
}

// ---- 初期ガチャ ----
export function GachaScreen({ state, onStart }) {
  const { region, job, family, body, gender, life } = getProfile(state)
  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    if (revealed >= 4) return undefined
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 400 : 700)
    return () => clearTimeout(t)
  }, [revealed])

  const cards = [
    {
      tag: 'ガチャA', head: '居住地域 × 性別', name: `${region.name}（${region.prefs}）・${gender === 'male' ? '男性' : '女性'}`,
      lines: [`健康寿命 ${life.healthy}歳 / 平均寿命 ${life.average}歳`, `物価係数 ${region.price.toFixed(2)} / 免許返納ペナルティ ${region.licensePenalty}`],
      scene: region.scene,
    },
    {
      tag: 'ガチャB', head: '職業・資産', name: job.name,
      lines: [`50歳貯蓄 ${job.savings50.toLocaleString()}万 / 60歳退職金 ${job.retire60.toLocaleString()}万`, `65歳年金 額面${job.gross65}万 / 手取り${job.net65}万（月）・50代年収(手取) ${job.income50s}万`],
      scene: job.scene,
    },
    { tag: 'ガチャC', head: '家族と住まい', name: family.name, lines: [`生活費倍率 ${family.livingMult.toFixed(2)}`, family.note], scene: null },
    { tag: 'ガチャD', head: '身体コンディション', name: body.name, lines: [`初期健康値 ${body.health} / 72歳の壁 補正 ${sign(body.wallBonus)}%`], scene: body.scene },
  ]

  return (
    <main className="screen">
      <p className="kicker">五十歳の誕生日。あなたの意思とは無関係に、後半生の初期条件が配られる。</p>
      <div className="gacha-grid">
        {cards.map((c, i) => (
          <article key={c.tag} className={`gacha-card${i < revealed ? ' is-open' : ''}`}>
            <span className="gacha-tag">{c.tag}・{c.head}</span>
            {i < revealed ? (
              <>
                <h3>{c.name}</h3>
                {c.lines.map((l) => <p key={l} className="gacha-line">{l}</p>)}
                {c.scene && <p className="gacha-scene">{c.scene}</p>}
              </>
            ) : (
              <div className="gacha-hidden" aria-hidden="true">？</div>
            )}
          </article>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn primary" disabled={revealed < 4} onClick={onStart}>この人生を生きる</button>
      </div>
    </main>
  )
}

// ---- 章扉 ----
export function ChapterScreen({ step, onNext }) {
  const ch = CHAPTERS[step.chapter]
  return (
    <main className="screen chapter-screen">
      <Illustration imageId={ch.imageId} title={`第${step.chapter}章『${ch.title}』`} />
      <p className="chapter-no">{step.chapter === 7 ? '最終章' : `第${step.chapter}章`}{'\u3000'}{ch.range}</p>
      <h2 className="chapter-title">『{ch.title}』</h2>
      <p className="haiku">{ch.haiku}</p>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onNext}>頁をめくる</button>
      </div>
    </main>
  )
}

// ---- イベント ----
export function EventScreen({ state, step, onChoose, onNext }) {
  const ev = EVENTS[step.id]
  const ctx = eventContext(state)
  const pending = state.pending
  const imageId = pending?.imageId || ev.imageId
  const choices = ev.choices(state, ctx)

  return (
    <main className="screen">
      <Illustration imageId={imageId} />
      <p className="kicker">{state.age}歳 ／ 第{ev.chapter}章『{CHAPTERS[ev.chapter].title}』</p>
      <h2 className="event-title">{ev.title}</h2>
      {ev.body(state, ctx).map((p) => <p key={p} className="prose">{p}</p>)}

      {ev.pensionChoice && !pending && <PensionTable state={state} />}

      {!pending && (
        <div className="choices">
          {choices.map((c) => {
            const av = choiceAvailability(state, c)
            return (
              <button
                key={c.id}
                type="button"
                className={`choice${av.ok ? '' : ' is-locked'}`}
                disabled={!av.ok}
                onClick={() => onChoose(c.id)}
              >
                <span className="choice-label">{c.label}</span>
                {c.detail && <span className="choice-detail">{c.detail}</span>}
                {!av.ok && <span className="choice-lock">{av.reason}</span>}
              </button>
            )
          })}
        </div>
      )}

      {pending && (
        <section className="result">
          <p className="result-choice">選んだ道：{pending.choiceLabel}</p>
          {pending.fragment && <blockquote className="fragment">{pending.fragment}</blockquote>}
          {pending.note && <p className="result-note">{pending.note}</p>}
          <Deltas deltas={pending.deltas} />
          <div className="actions">
            <button type="button" className="btn primary" onClick={onNext}>次へ</button>
          </div>
        </section>
      )}
    </main>
  )
}

function PensionTable({ state }) {
  const { job } = getProfile(state)
  return (
    <div className="table-wrap">
      <table className="pension-table">
        <caption>あなたの年金（月額）の比較</caption>
        <thead>
          <tr><th>開始</th><th>額面</th><th>手取り率</th><th>手取り</th><th>65歳比</th><th>損益分岐点（手取りベース）</th></tr>
        </thead>
        <tbody>
          {[60, 65, 70, 75].map((age) => {
            const r = PENSION_TABLE[age]
            return (
              <tr key={age}>
                <th>{r.label}</th>
                <td>{(job.gross65 * r.grossMult).toFixed(1)}万</td>
                <td>{(r.takeHome * 100).toFixed(1)}%</td>
                <td><strong>{(job.net65 * r.realMult).toFixed(1)}万</strong></td>
                <td>×{r.realMult.toFixed(3)}</td>
                <td>{r.breakEven}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="table-note">選ばなかった年齢には、同級生の健太・誠一・遥が割り振られ、あなたと並走します。</p>
    </div>
  )
}

// ---- 同窓会 ----
export function ReunionScreen({ state, step, onNext }) {
  const scene = getReunion(state, step.age)
  const rows = compareAt(state, step.age)
  return (
    <main className="screen">
      <Illustration imageId={step.imageId} title={step.title} />
      <p className="kicker">★ {step.title} ／ {step.place}</p>
      <div className="members">
        {rows.filter((r) => !r.isPlayer).map((r) => (
          <span key={r.id} className={`member${r.present ? '' : ' is-absent'}`}>
            {NPC_DATA[r.id].name}<small>{r.pensionAge}歳受給{r.present ? '' : '・空席'}</small>
          </span>
        ))}
      </div>
      {scene.paragraphs.map((p) => <p key={p} className="prose novel-like">{p}</p>)}
      <CompareChart rows={rows} age={step.age} />
      <div className="actions">
        <button type="button" className="btn primary" onClick={onNext}>店を出る</button>
      </div>
    </main>
  )
}

// ---- エンディング ----
export function EndingScreen({ state, onRead, onRestart }) {
  const rows = compareAt(state, 85)
  const { region, job, family } = getProfile(state)
  return (
    <main className="screen">
      <Illustration imageId="img_final_85" title="八十五歳、秋" />
      <p className="kicker">エンディング</p>
      <h2 className="event-title">八十五年の、その先で</h2>
      <dl className="summary">
        <div><dt>暮らした場所</dt><dd>{region.name}</dd></div>
        <div><dt>働き方</dt><dd>{job.name}</dd></div>
        <div><dt>家族と住まい</dt><dd>{family.name}</dd></div>
        <div><dt>年金</dt><dd>{state.pensionAge}歳から受給</dd></div>
        <div><dt>最終資産</dt><dd>{Math.round(totalAssets(state)).toLocaleString()}万円</dd></div>
        <div>
          <dt>NISA運用</dt>
          <dd>
            {state.investPrincipal > 0
              ? `${state.flags.panicSold ? '暴落時に売却' : `評価額 ${Math.round(state.invest).toLocaleString()}万円`}（元本 ${state.investPrincipal.toLocaleString()}万円）`
              : '運用なし'}
          </dd>
        </div>
        {family.married && <div><dt>配偶者の年金</dt><dd>{state.spousePensionAge}歳から受給</dd></div>}
        {state.flags.partner && <div><dt>六十四歳の出会い</dt><dd>{state.flags.partner === 'married' ? '熟年結婚' : '通い婚'}</dd></div>}
        <div><dt>72歳の壁</dt><dd>{state.flags.mobilityLimited ? '激突（要支援）' : '突破'}</dd></div>
      </dl>
      <CompareChart rows={rows} age={85} />
      <div className="actions">
        <button type="button" className="btn primary" onClick={onRead}>あなたの後半生を小説で読む</button>
        <button type="button" className="btn ghost" onClick={onRestart}>タイトルへ戻る</button>
      </div>
    </main>
  )
}
