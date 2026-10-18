// 小説の地の文用：数値を漢数字に（例 2815 → 二千八百十五）
const DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

function under10000(n) {
  let out = ''
  for (const [unit, label] of [[1000, '千'], [100, '百'], [10, '十']]) {
    const d = Math.floor(n / unit)
    if (d) out += (d === 1 ? '' : DIGITS[d]) + label
    n %= unit
  }
  return out + (n ? DIGITS[n] : '')
}

export function kanjiNumber(value) {
  let n = Math.round(Math.abs(value))
  if (n === 0) return '〇'
  const oku = Math.floor(n / 100000000)
  n %= 100000000
  const man = Math.floor(n / 10000)
  const rest = n % 10000
  return (value < 0 ? 'マイナス' : '')
    + (oku ? `${under10000(oku)}億` : '')
    + (man ? `${under10000(man)}万` : '')
    + (rest ? under10000(rest) : '')
}
