// エンディング時の短編小説ビルド＆出力エンジン（SPEC.md 第8章）
import { getProfile, compareAt } from './engine.js'
import { kanjiNumber } from './kanji.js'

export const ACTS = [
  { act: 1, title: '第一幕　五十路の交差点', imageId: 'img_start_50' },
  { act: 2, title: '第二幕　六十歳の決断と、最初の同窓会', imageId: 'img_reunion_62' },
  { act: 3, title: '第三幕　通帳の数字と、夕暮れの匂い', imageId: 'img_bankbook' },
  { act: 4, title: '第四幕　七十二歳の壁', imageId: 'img_reunion_73' },
  { act: 5, title: '終幕　損益分岐点の向こう側で', imageId: 'img_reunion_82' },
]

// 選択の結果からタイトルを組み立てる
export function buildTitle(state) {
  const { region } = getProfile(state)
  const f = state.flags
  if (f.housing === 'drafty' && state.memory >= 50) return `${region.motif}と、色褪せない写真`
  if (f.mobilityLimited && state.memory < 40) return '八十二歳の通帳と、開かれなかった旅行鞄'
  if (f.mobilityLimited) return '七十二歳の朝と、引き出しの中の海'
  if (state.memory >= 50) return `${region.motif}と、六十二歳の乾杯`
  if (state.assets >= 1500) return '八十二歳の通帳と、静かな紅茶'
  if (state.pensionAge >= 70) return `${region.motif}と、待ち続けた年金`
  return `${region.motif}と、それからの日々`
}

function openingParagraphs(state) {
  const { region, job, family, body, gender } = getProfile(state)
  const familyLine = gender === 'female' && family.lineFemale ? family.lineFemale : family.line
  return [region.opening, job.work, familyLine, body.line]
}

function closingMonologue(state) {
  const { region, family } = getProfile(state)
  const rows = compareAt(state, 85)
  const me = rows[0]
  const others = rows.slice(1).filter((r) => r.present)
  const richer = others.filter((r) => r.cum > me.cum).length
  const p = []

  const place = state.flags.housing === 'care' ? '新しい部屋の' : family.rent ? '古いアパートの' : '古い家の'
  p.push(`八十五歳の秋、私は${place}窓辺で、通帳とアルバムを並べて膝の上に置いた。西日が写真立ての硝子を照らし、その光が天井に小さな四角い窓をつくっている。`)

  const money = Math.round(state.assets)
  const ledger = money >= 1000
    ? `通帳の最後の行には、${kanjiNumber(money)}万円という数字が印字されていた。使い切れなかった数字だ。`
    : money >= 0
      ? `通帳の最後の行には、${kanjiNumber(money)}万円という数字が印字されていた。足りるとも、足りないとも言えない、私らしい数字だった。`
      : '通帳の最後の行は、とうに赤い数字になっていた。それでも私は、こうして秋の光の中にいる。'
  p.push(`${ledger}受け取った年金の手取りは、累計で${kanjiNumber(me.cum)}万円。${richer === 0 ? '同級生の誰よりも多い。' : `同級生のうち${kanjiNumber(richer)}人が、私より多くを受け取っている。`}けれど、その順位を気にしている自分は、もうどこにもいなかった。`)

  if (state.memory >= 50) {
    p.push('アルバムをめくると、潮風の匂いが、旅館の畳の感触が、まだ脚の動いた頃の坂道が、次々に立ち上がってくる。身体が動かなくなってからも、この思い出たちは毎年、少しずつ利息をつけて私のもとへ戻ってきた。通帳には印字されない、もうひとつの残高だった。')
  } else if (state.memory > 0) {
    p.push('アルバムは、思ったより薄かった。それでも数少ない写真の一枚一枚が、驚くほど鮮やかに、あの日の光と音を連れてくる。あと何ページか、あってもよかった。そう思えることが、たぶん私の人生の正直な答えなのだ。')
  } else {
    p.push('アルバムを開くと、五十代の写真の後ろは、ほとんど白い台紙のままだった。行きたかった場所の名前を、私はひとつずつ指でなぞった。どこにも行かなかったかわりに、私はここまで来た。それもまた、一つの旅だったのかもしれない。')
  }

  p.push(state.flags.mobilityLimited
    ? '七十二の冬の朝から、私の世界は少しずつ狭くなった。けれど狭くなった世界の中で、私は一杯の白湯の温かさや、障子に映る木の影の揺れを、若い頃よりずっと深く味わえるようになった。'
    : '私の脚は、八十五になった今も、なんとか台所と窓辺のあいだを往復してくれる。七十二の壁の向こう側に、こんなに静かな日々があるとは思わなかった。')

  p.push(`窓の外では、${region.seasonWord}の気配が、夕暮れの色に溶けていく。損益分岐点というものが本当にあるのなら、それはきっと、通帳の上ではなく、この胸のどこかに引かれた一本の線なのだろう。私はアルバムを閉じ、眼鏡を外して、もう少しだけ、暮れていく空を見ていた。`)
  return p
}

export function buildNovel(state) {
  const acts = ACTS.map(({ act, title, imageId }) => {
    const paragraphs = []
    if (act === 1) paragraphs.push(...openingParagraphs(state))
    for (const f of state.fragments.filter((x) => x.act === act)) {
      paragraphs.push(...f.text.split('\n'))
    }
    if (act === 5) paragraphs.push(...closingMonologue(state))
    return { act, title, imageId, paragraphs }
  })
  const title = buildTitle(state)
  const text = [`『${title}』`, '', ...acts.flatMap((a) => [a.title, '', ...a.paragraphs.map((p) => `\u3000${p}`), ''])].join('\n')
  return { title, acts, text, length: text.replace(/\s/g, '').length }
}
