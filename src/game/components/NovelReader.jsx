import { useState } from 'react'
import Illustration from './Illustration.jsx'

// 完成した短編小説を読むリーダー（縦書き/横書き切替・全文コピー・テキスト保存）
export function NovelReader({ novel, onClose, onSave, saved }) {
  const [vertical, setVertical] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(novel.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([novel.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${novel.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="screen reader">
      <div className="reader-tools">
        <button type="button" className="btn small" onClick={() => setVertical((v) => !v)}>
          {vertical ? '横書きで読む' : '縦書きで読む'}
        </button>
        <button type="button" className="btn small" onClick={copy}>{copied ? 'コピーしました' : '全文をコピー'}</button>
        <button type="button" className="btn small" onClick={download}>テキストで保存</button>
        {onSave && (
          <button type="button" className="btn small" onClick={onSave} disabled={saved}>
            {saved ? '本棚に保存済み' : '本棚に保存'}
          </button>
        )}
        <button type="button" className="btn small ghost" onClick={onClose}>閉じる</button>
      </div>

      <article className={`novel${vertical ? ' is-vertical' : ''}`}>
        <header className="novel-head">
          <h1 className="novel-title">『{novel.title}』</h1>
          <p className="novel-meta">全五幕・{novel.length.toLocaleString()}字</p>
        </header>
        {novel.acts.map((act) => (
          <section key={act.act} className="novel-act">
            {!vertical && <Illustration imageId={act.imageId} />}
            <h2 className="novel-act-title">{act.title}</h2>
            {act.paragraphs.map((p, i) => <p key={`${act.act}-${i}`}>{p}</p>)}
          </section>
        ))}
        <p className="novel-end">（了）</p>
      </article>
    </main>
  )
}

export function Bookshelf({ shelf, onOpen, onRemove, onClose }) {
  return (
    <main className="screen">
      <h2 className="event-title">本棚</h2>
      <p className="kicker">これまでに生きた後半生の物語</p>
      <ul className="shelf">
        {shelf.map((b) => (
          <li key={b.id} className="shelf-item">
            <button type="button" className="shelf-open" onClick={() => onOpen(b)}>
              <span className="shelf-title">『{b.title}』</span>
              <span className="shelf-meta">{b.summary} ／ {new Date(b.savedAt).toLocaleDateString('ja-JP')}</span>
            </button>
            <button type="button" className="btn small ghost" onClick={() => onRemove(b.id)}>削除</button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>タイトルへ戻る</button>
      </div>
    </main>
  )
}
