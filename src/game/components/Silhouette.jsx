// 画像未配置時に描く情緒的なSVGシルエット（viewBox 320×180）
const ground = <rect x="0" y="150" width="320" height="30" />

const SHAPES = {
  city: (
    <>
      <path d="M0 150V96h22V80h18v70h10V60h26v90h8V88h20v62h14V70h30v80h10V92h18v58h12V66h24v84h10V84h22v66h16V100h20v50z" />
      <path d="M150 150v-62h4v62zM140 92h24v6h-24z" />
      <circle cx="248" cy="58" r="14" opacity="0.35" />
      {ground}
    </>
  ),
  window: (
    <>
      <path d="M90 30h140v120H90zM98 38v52h58V38zm66 0v52h58V38zM98 98v44h58V98zm66 0v44h58V98z" fillRule="evenodd" />
      <path d="M40 150c10-26 30-38 50-38v38z" opacity="0.6" />
      {ground}
    </>
  ),
  car: (
    <>
      <path d="M70 140c0-10 6-16 16-18l22-26c4-5 10-8 18-8h58c8 0 14 3 19 8l24 26c12 2 20 8 20 18v8H70z" />
      <circle cx="110" cy="148" r="12" />
      <circle cx="214" cy="148" r="12" />
      <circle cx="262" cy="44" r="18" opacity="0.35" />
      {ground}
    </>
  ),
  counter: (
    <>
      <path d="M40 110h240v40H40z" />
      <path d="M60 40h200v62H60z" opacity="0.35" />
      <path d="M150 70c8 0 14 7 14 16v24h-28V86c0-9 6-16 14-16zM144 58a8 8 0 1 0 12 0 8 8 0 1 0-12 0z" />
      <path d="M92 64h40v4H92zm0 12h40v4H92zm96-12h40v4h-40zm0 12h40v4h-40z" opacity="0.6" />
      {ground}
    </>
  ),
  desk: (
    <>
      <path d="M60 112h200v8H60zM72 120h8v30h-8zm168 0h8v30h-8z" />
      <path d="M120 70h70v40h-70zM150 110h10v4h-10z" />
      <path d="M210 82a14 14 0 1 1 0 28h-4v-28z" opacity="0.7" />
      <path d="M40 20h240v6H40z" opacity="0.4" />
      {ground}
    </>
  ),
  bench: (
    <>
      <path d="M90 118h140v8H90zm0-18h140v8H90zM100 126h6v24h-6zm108 0h6v24h-6z" />
      <path d="M262 150V70m0 0c-20 0-30-14-30-28 0-18 16-28 30-28s30 10 30 28c0 14-10 28-30 28" />
      <path d="M258 150V72h8v78z" />
      <circle cx="60" cy="40" r="16" opacity="0.35" />
      {ground}
    </>
  ),
  izakaya: (
    <>
      <path d="M40 60h240v8H40z" />
      <path d="M70 68h24v40H70zm46 0h24v40h-24zm46 0h24v40h-24zm46 0h24v40h-24z" opacity="0.6" />
      <ellipse cx="160" cy="38" rx="16" ry="20" opacity="0.8" />
      <path d="M156 16h8v4h-8z" />
      <path d="M50 126h220v8H50zM100 108h10v18h-10zm40-4h10v22h-10zm40 6h10v16h-10zm40-2h10v18h-10z" />
      {ground}
    </>
  ),
  bankbook: (
    <>
      <path d="M90 50l120-14 20 100-120 14z" />
      <path d="M104 64l92-11 2 10-92 11zm4 22l92-11 2 10-92 11zm4 22l92-11 2 10-92 11z" fill="#fff" opacity="0.35" />
      <path d="M230 40h40v80h-40z" opacity="0.4" />
      {ground}
    </>
  ),
  graph: (
    <>
      <path d="M50 30v116h230v-6H56V30z" />
      <path d="M64 128l40-26 30 12 40-40 30 16 44-50 4 4-48 56-30-16-40 40-30-12-36 24z" />
      <path d="M90 140v-16h10v16zm40 0v-22h10v22zm40 0v-40h10v40zm40 0v-30h10v30zm40 0v-60h10v60z" opacity="0.5" />
      {ground}
    </>
  ),
  crash: (
    <>
      <path d="M50 30v116h230v-6H56V30z" />
      <path d="M64 50l40 16 30-10 40 30 30-6 44 54-4 4-42-50-30 6-40-30-30 10-36-14z" />
      <path d="M248 128l20 8-4-22z" />
      <path d="M90 140V96h10v44zm40 0v-60h10v60zm40 0v-44h10v44zm40 0v-30h10v30zm40 0v-14h10v14z" opacity="0.5" />
      {ground}
    </>
  ),
  dog: (
    <>
      <path d="M120 150v-34c0-14 10-24 24-26l36-4c8-1 14-6 16-14l4-14c2-6 8-10 14-8l10 4 6-8 4 10c6 4 8 12 4 18l-6 8c-4 6-10 8-16 8l-2 20v40h-10v-30h-44v30h-10v-30l-8-2v32z" />
      <path d="M120 116c-12-2-20-12-18-24 4 8 10 12 18 12z" />
      <circle cx="262" cy="44" r="16" opacity="0.35" />
      {ground}
    </>
  ),
  easel: (
    <>
      <path d="M150 30l-46 120h8l18-46h60l18 46h8L170 30z" />
      <path d="M118 44h84v62h-84z" opacity="0.75" />
      <path d="M126 92c14-20 24-24 36-12s22 8 32-8v30h-68z" fill="#fff" opacity="0.3" />
      <circle cx="240" cy="120" r="10" opacity="0.6" />
      <path d="M232 128l8 22h-4l-8-20z" opacity="0.6" />
      {ground}
    </>
  ),
  stage: (
    <>
      <path d="M110 0h100l40 150H70z" opacity="0.18" />
      <path d="M40 132h240v18H40z" />
      <path d="M126 96a10 10 0 1 1 0.1 0zm-10 14h20v22h-20zM186 96a10 10 0 1 1 0.1 0zm-10 14h20v22h-20z" />
      <path d="M156 88a10 10 0 1 1 0.1 0zm-10 14h20v30h-20z" />
      {ground}
    </>
  ),
  sea: (
    <>
      <circle cx="200" cy="104" r="26" opacity="0.5" />
      <path d="M0 112h320v38H0z" opacity="0.55" />
      <path d="M0 112c40-30 70-50 110-50s50 30 70 50z" />
      <path d="M220 124h60l-6 8h-48z" />
      <path d="M248 124v-26l18 26z" />
      {ground}
    </>
  ),
  broom: (
    <>
      <path d="M150 40c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18zM136 80h28l6 70h-40z" />
      <path d="M176 60l50 80-6 4-50-80z" />
      <path d="M214 136l26 8-12 10-22-10z" />
      <path d="M40 150c4-10 14-14 24-12 4-8 16-10 22-2 10-2 18 6 16 14z" opacity="0.7" />
      {ground}
    </>
  ),
  futon: (
    <>
      <path d="M40 120c0-14 10-22 26-22h180c18 0 34 8 34 22v30H40z" />
      <ellipse cx="80" cy="104" rx="26" ry="10" opacity="0.7" />
      <path d="M220 30h50v60h-50z" opacity="0.35" />
      <circle cx="245" cy="60" r="12" opacity="0.6" />
      {ground}
    </>
  ),
  washoku: (
    <>
      <path d="M50 120h220v10H50z" />
      <path d="M90 104c0-8 10-14 22-14s22 6 22 14zm96 0c0-8 10-14 22-14s22 6 22 14z" />
      <path d="M140 112h40v8h-40z" />
      <path d="M40 20v84m20-84v84m200-84v84m20-84v84" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      {ground}
    </>
  ),
  house: (
    <>
      <path d="M90 90l70-48 70 48v60H90z" />
      <path d="M140 110h40v40h-40z" fill="#fff" opacity="0.25" />
      <path d="M200 46h12v24h-12z" />
      <path d="M0 40l4 10M30 30l4 10M60 44l4 10M260 34l4 10M290 46l4 10M240 60l4 10" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      {ground}
    </>
  ),
  busstop: (
    <>
      <path d="M100 40h8v110h-8z" />
      <circle cx="104" cy="40" r="18" />
      <path d="M150 124h80v6h-80zM156 130h6v20h-6zm62 0h6v20h-6z" />
      <path d="M190 104c6 0 10 4 10 10v10h-20v-10c0-6 4-10 10-10zm-4-14a6 6 0 1 0 8 0 6 6 0 1 0-8 0z" />
      {ground}
    </>
  ),
  windowsill: (
    <>
      <path d="M60 20h200v110H60zM70 30v90h85V30zm95 0v90h85V30z" fillRule="evenodd" />
      <path d="M40 130h240v10H40z" />
      <path d="M200 112h30v18h-30z" opacity="0.8" />
      <path d="M110 118h24l-2 12h-20z" />
      {ground}
    </>
  ),
  teacup: (
    <>
      <path d="M110 100h80c0 22-18 36-40 36s-40-14-40-36z" />
      <path d="M190 106c14 0 18 14 4 18" fill="none" stroke="currentColor" strokeWidth="5" />
      <ellipse cx="150" cy="138" rx="56" ry="6" />
      <path d="M140 60c-6 10 6 16 0 26m20-26c-6 10 6 16 0 26" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M30 20h70v100H30zm190 0h70v100h-70z" opacity="0.25" />
      {ground}
    </>
  ),
}

export default function Silhouette({ icon }) {
  return (
    <svg className="silhouette" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g fill="currentColor">{SHAPES[icon] || SHAPES.city}</g>
    </svg>
  )
}
