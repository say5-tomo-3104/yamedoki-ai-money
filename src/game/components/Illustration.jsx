import { useState } from 'react'
import { ILLUSTRATIONS } from '../data/illustrations.js'
import Silhouette from './Silhouette.jsx'

// 16:9 のイラスト枠。assets/images/${imageId}.jpg が読み込めればそれを重ね、
// 無ければ壊れたアイコンを出さずに CSS グラデーション＋シルエット＋字幕を見せる。
export default function Illustration({ imageId, title }) {
  const [status, setStatus] = useState({ id: null, value: 'loading' })
  const info = ILLUSTRATIONS[imageId] || { caption: title || '', sub: '', sky: ['#e9dcc7', '#c9a98a', '#6d5a63'], icon: 'city' }
  const current = status.id === imageId ? status.value : 'loading'
  const src = `${import.meta.env.BASE_URL}assets/images/${imageId}.jpg`

  return (
    <figure className="illust">
      <div
        className="illust-fallback"
        style={{ background: `linear-gradient(180deg, ${info.sky[0]} 0%, ${info.sky[1]} 58%, ${info.sky[2]} 100%)` }}
      >
        <Silhouette icon={info.icon} />
        <figcaption className="illust-subtitle">
          <span className="illust-caption">{title || info.caption}</span>
          {info.sub && <span className="illust-sub">{info.sub}</span>}
        </figcaption>
      </div>
      {current !== 'error' && (
        <img
          className={current === 'loaded' ? 'is-loaded' : ''}
          src={src}
          alt={info.caption}
          onLoad={() => setStatus({ id: imageId, value: 'loaded' })}
          onError={() => setStatus({ id: imageId, value: 'error' })}
        />
      )}
    </figure>
  )
}
