// 50歳〜85歳の年代別イベントと小説フラグメント（SPEC.md 第6章）
// effect の単位: assets=万円 / health・heart・memory=ポイント
// fragment は文字列、または (state, ctx) => 文字列。効果を適用した後に評価される。
import { PENSION_TABLE, DISABILITY_PENSION_MONTHLY } from './tables.js'

const g = (ctx, male, female) => (ctx.gender === 'male' ? male : female)
const spouse = (ctx) => g(ctx, '妻', '夫')

export const CHAPTERS = {
  1: { title: '夕暮れの予兆', range: '50〜54歳', imageId: 'img_start_50', haiku: '秋の暮　封を切らざる白き文' },
  2: { title: 'カウントダウン', range: '55〜59歳', imageId: 'img_countdown_57', haiku: '蝉時雨　残りの夏を指で折る' },
  3: { title: '運命の分岐点', range: '60〜64歳', imageId: 'img_pension_60', haiku: '花冷えや　四つの数字の窓口に' },
  4: { title: '黄金のロスタイム', range: '65〜69歳', imageId: 'img_bankbook', haiku: '冬の水　蛇口の先の針ひとつ' },
  5: { title: '七十二歳の壁', range: '70〜74歳', imageId: 'img_health_wall_72', haiku: '寒の朝　足の指から目覚めけり' },
  6: { title: '後期高齢者の現実', range: '75〜79歳', imageId: 'img_late_75_home', haiku: '梅雨深し　天井の染み地図となる' },
  7: { title: '損益分岐点の向こう側', range: '80〜85歳', imageId: 'img_final_85', haiku: '若葉風　回転扉に手を重ね' },
}

export const STEPS = [
  { type: 'gacha' },
  { type: 'chapter', chapter: 1, age: 50 },
  { type: 'event', id: 'e52_dock', age: 52 },
  { type: 'event', id: 'e54_title', age: 54 },
  { type: 'chapter', chapter: 2, age: 55 },
  { type: 'event', id: 'e55_care', age: 55 },
  { type: 'event', id: 'e57_downsize', age: 57 },
  { type: 'chapter', chapter: 3, age: 60 },
  { type: 'event', id: 'e60_pension', age: 60 },
  { type: 'event', id: 'e60_spouse', age: 60 },
  { type: 'event', id: 'e60_work', age: 60 },
  { type: 'event', id: 'e60_invest', age: 60 },
  { type: 'reunion', age: 62, act: 2, imageId: 'img_reunion_62', title: '六十二歳の同窓会', place: '駅前の居酒屋「ほたる」' },
  { type: 'event', id: 'e63_illness', age: 63 },
  { type: 'event', id: 'e64_romance', age: 64 },
  { type: 'chapter', chapter: 4, age: 65 },
  { type: 'event', id: 'e65_atm', age: 65 },
  { type: 'event', id: 'e67_winter', age: 67 },
  { type: 'event', id: 'e68_crash', age: 68 },
  { type: 'chapter', chapter: 5, age: 70 },
  { type: 'event', id: 'e70_premium', age: 70 },
  { type: 'event', id: 'e72_wall', age: 72 },
  { type: 'reunion', age: 73, act: 4, imageId: 'img_reunion_73', title: '七十三歳の同窓会', place: '雨の午後の和食店' },
  { type: 'chapter', chapter: 6, age: 75 },
  { type: 'event', id: 'e75_late', age: 75 },
  { type: 'event', id: 'e77_license', age: 77 },
  { type: 'event', id: 'e78_daily', age: 78 },
  { type: 'chapter', chapter: 7, age: 80 },
  { type: 'event', id: 'e82_housing', age: 82 },
  { type: 'reunion', age: 82, act: 5, imageId: 'img_reunion_82', title: '八十二歳、最後の同窓会', place: 'ホテルのティーラウンジ' },
  { type: 'ending', age: 85 },
]

const receiving = (s) => s.pensionAge && s.age >= s.pensionAge
const total = (s) => s.assets + (s.invest || 0)
const man = (v) => `${Math.round(v).toLocaleString()}万円`

export const EVENTS = {
  // ---- 第1章 ----
  e52_dock: {
    chapter: 1, act: 1, imageId: 'img_start_50',
    title: '五十二歳の人間ドックと「要精密検査」の封筒',
    body: () => [
      '秋の人間ドックの結果が届いた。白い封筒の窓から、赤い「要精密検査」の文字が透けて見える。',
      '医師は「今ならまだ間に合います」と言った。何に間に合うのかは、言わなかった。',
    ],
    choices: () => [
      {
        id: 'gym', label: '月1万円のジムに通い、晩酌と塩分を控える', detail: '資産-60万 / 健康+15 / 心-5',
        effect: { assets: -60, health: 15, heart: -5, flags: { gym: true } },
        fragment: '五十二歳の秋、人間ドックの赤い数字に背中を押され、私は夜の晩酌をスニーカーに替えた。駅前のジムのランニングマシンは、どこにも辿り着かない道のようだった。それでも汗が首筋を伝うたび、身体の奥で錆びついていた何かが、少しずつ回り始める音がした。あの時流した汗が、のちの私を救うことになる。',
      },
      {
        id: 'drink', label: 'ストレス発散が第一。今まで通り飲んで食べる', detail: '資産±0 / 健康-15 / 心+10',
        effect: { health: -15, heart: 10, flags: { drinker: true } },
        fragment: '五十二歳の秋、検査結果の封筒を机の奥にしまい込み、私はいつもの居酒屋の暖簾をくぐった。カウンターの端の席で、ジョッキの表面を水滴が一筋流れ落ちる。冷たいビールが喉を鳴らす瞬間だけが、五十路の重圧を忘れさせてくれた。封筒は、その冬のあいだ一度も開かれなかった。',
      },
    ],
  },

  e54_title: {
    chapter: 1, act: 1, imageId: 'img_start_50',
    title: '役職定年と肩書きの喪失',
    body: (s, ctx) => {
      if (ctx.job.id === 'B5') return ['長年の取引先の担当者が、息子ほどの年の若者に代わった。「これからは全部オンラインでお願いします」。', '五十四歳。自分の腕だけで渡ってきた川の流れが、少しだけ速くなった。']
      if (ctx.job.id === 'B6') return ['契約更新の面談で、現場のリーダー役を若い社員に譲るよう言われた。', '五十四歳。小さな肩書きでも、なくなると首筋が寒かった。']
      return ['五十四歳の四月一日、私の名刺から肩書きが消えた。役職定年。', '新しい名刺は、前よりも少しだけ軽かった。']
    },
    choices: () => [
      {
        id: 'hobby', label: '競争から降り、定時で帰って自分の趣味（執筆・音楽・旅）を始める', detail: '資産±0 / 健康+5 / 心+15 / 趣味フラグ',
        effect: { health: 5, heart: 15, flags: { hobby: true } },
        fragment: '五十四歳の春、私は出世の階段から静かに降りた。定時のチャイムとともに外へ出ると、空はまだ明るかった。帰りに文房具屋で買った一冊のノートに、私は初めて、誰にも頼まれていない文章を書いた。インクの匂いが、ずいぶん懐かしかった。',
      },
      {
        id: 'overtime', label: 'プライドを守るため、残業で稼ぎ続ける', detail: '資産+150万 / 健康-10 / 心-10',
        effect: { assets: 150, health: -10, heart: -10 },
        fragment: '肩書きのない名刺を配りながら、私は誰よりも遅くまで職場に残った。蛍光灯の消えたフロアで、自分の机の灯りだけが孤島のように浮かんでいる。残業代は通帳を太らせた。そのかわり、季節がいつ変わったのか、私は一度も気づかなかった。',
      },
    ],
  },

  // ---- 第2章 ----
  e55_care: {
    chapter: 2, act: 1, imageId: 'img_care_55',
    when: (s, ctx) => ctx.family.id === 'C4',
    title: '母の介護と、実家の長い廊下',
    body: () => [
      '築四十五年の実家で、母が廊下で転んだ。夜中の物音に駆けつけると、母は「大丈夫、大丈夫」と繰り返しながら、立ち上がれずにいた。',
      '要介護二。ケアマネジャーの説明を聞きながら、私は手帳の白いページを見つめていた。',
    ],
    choices: () => [
      {
        id: 'self', label: '介護休業をとり、自分で看る', detail: '資産-200万 / 健康-10 / 心+5',
        effect: { assets: -200, health: -10, heart: 5 },
        fragment: '五十五歳の冬、私は介護休業をとって、母の枕元で暮らした。おむつを替え、粥を炊き、夜中に何度も呼ばれて廊下を往復した。軋む床板のその音を、私はそのとき初めて、母が何十年も鳴らしてきた足音だったのだと知った。',
      },
      {
        id: 'facility', label: '介護施設に預け、仕事を続ける', detail: '資産-350万 / 心-5',
        effect: { assets: -350, heart: -5 },
        fragment: '五十五歳の冬、私は母を介護施設に預けた。面会の帰り道、バックミラーに映る施設の灯りが小さくなっていく。月々の請求書と、ほっとしてしまった自分への後ろめたさを、私は同じ引き出しにしまった。',
      },
    ],
  },

  e57_downsize: {
    chapter: 2, act: 1, imageId: 'img_countdown_57',
    title: '住まいと車のダウンサイジング',
    body: () => [
      '定年まで、あと三年。車検の通知と一緒に、老後の資金計画のパンフレットが届いた。',
      '暮らしの大きさを、いまのうちに測り直すべきだろうか。',
    ],
    choices: () => [
      {
        id: 'downsize', label: '維持費の安い軽自動車（コンパクトな暮らし）へ切り替える', detail: '資産+100万 / 60代の旅費が軽くなる',
        effect: { assets: 100, flags: { downsized: true } },
        fragment: '五十七歳の夏、長年乗った大きな車を手放し、小さな軽自動車に乗り換えた。運転席に座ると、ドアの内張りがやけに近い。それでもガソリンスタンドの領収書の数字が半分になったとき、暮らしというものは、案外この大きさで足りるのだと思った。',
      },
      {
        id: 'keep', label: '見栄と快適さを優先し、今の生活水準を維持する', detail: '資産-150万 / 心+10',
        effect: { assets: -150, heart: 10 },
        fragment: '五十七歳の夏、ディーラーで新しい車の契約書に判を押した。新車の匂いのするシートに身を沈めると、まだ自分は終わっていないという気がした。見栄だと笑われてもいい。あの革の匂いは、確かに私を一年ぶん若くした。',
      },
    ],
  },

  // ---- 第3章 ----
  e60_pension: {
    chapter: 3, act: 2, imageId: 'img_pension_60', pensionChoice: true,
    title: '★年金の受給開始年齢を決める',
    body: () => [
      '六十歳の誕生日の翌週、年金事務所の窓口で、私は四つの数字を見比べていた。',
      '同じ一生ぶんの年金が、受け取り始める年齢によって、まるで別の顔になる。額面ではなく、税金と社会保険料を引いた「手取り」で比べなければならない。',
    ],
    choices: (s, ctx) => [60, 65, 70, 75].map((age) => {
      const row = PENSION_TABLE[age]
      const gross = Math.round(ctx.job.gross65 * row.grossMult * 10) / 10
      const net = Math.round(ctx.job.net65 * row.realMult * 10) / 10
      return {
        id: `p${age}`, label: `${age}歳から受け取る`,
        detail: `額面 月${gross}万 → 手取り 月${net}万（手取り率${(row.takeHome * 100).toFixed(1)}%）／${row.breakEven}`,
        effect: { pensionAge: age },
        fragment: PENSION_FRAGMENTS[age],
      }
    }),
  },

  e60_spouse: {
    chapter: 3, act: 2, imageId: 'img_pension_60',
    when: (s, ctx) => ctx.family.married,
    title: '配偶者の年金は、いつから受け取る？',
    body: (s, ctx) => [
      `${spouse(ctx)}にも、自分の年金がある。65歳から受け取れば手取りで月${ctx.family.spousePension}万円。`,
      `夫婦の受け取り方は、別々に決められる。たとえば${spouse(ctx)}だけ60歳から受け取って、${s.pensionAge}歳までの家計の谷間を埋めるという手もある。`,
    ],
    choices: (s, ctx) => [60, 65, 70].map((age) => {
      const net = Math.round(ctx.family.spousePension * PENSION_TABLE[age].realMult * 10) / 10
      return {
        id: `sp${age}`, label: `${spouse(ctx)}は${age}歳から受け取る`,
        detail: `${spouse(ctx)}の手取り 月${net}万円（${age}歳から）`,
        effect: { spousePensionAge: age },
        fragment: SPOUSE_FRAGMENTS[age](ctx, s),
      }
    }),
  },

  e60_work: {
    chapter: 3, act: 2, imageId: 'img_work_60_office',
    title: '六十歳定年、月曜日の朝の働き方',
    body: (s) => [
      '六十歳。定年の花束は、帰りの電車の網棚の上で、少しだけ萎れていた。',
      receiving(s)
        ? 'もう年金は振り込まれ始める。それでも、月曜日の朝をどう過ごすかは、自分で決めなければならない。'
        : `年金の振込は、まだ${s.pensionAge - 60}年先だ。働かなければ、貯金だけが減っていく。`,
    ],
    choices: () => [
      {
        id: 'rehire', label: '定年再雇用で会社に残る（給与4割減・元部下が上司）', detail: '5年間で労働収入+1,100万 / 健康-15 / 心-20',
        imageId: 'img_work_60_office',
        effect: { work: { perYear: 220, until: 65 }, health: -15, heart: -20 },
        fragment: '六十歳の春、私は同じデスクに座りながら、半分近くになった給与明細を見つめていた。かつての部下に敬語で決裁を仰ぐ夕方、蛍光灯は妙に白々しく目に染みた。それでも毎月の振込は、通帳の上で確かな重さを持っていた。誇りと引き換えにした数字は、思ったより冷たくて、思ったより頼もしかった。',
      },
      {
        id: 'part', label: '週3日の気楽なシニアパート（施設管理・送迎など）に移る', detail: '5年間で労働収入+450万 / 健康±0 / 心+10',
        imageId: 'img_work_60_office',
        effect: { work: { perYear: 90, until: 65 }, heart: 10 },
        fragment: '会社という鎧を脱ぎ捨て、週に三日だけ働く暮らしを選んだ。市民体育館の管理の仕事で、腰に下げた鍵束の重さにもすぐ慣れた。水曜日の昼下がり、誰もいない公園のベンチで飲む缶コーヒーは、現役時代のどんな高級な一杯よりも自由な味がした。',
      },
      {
        id: 'free', label: '完全リタイアして「平日の自由」を謳歌する', detail: '労働収入0 / 健康+10 / 心+30 / 思い出+20',
        imageId: 'img_work_60_free',
        effect: { work: { perYear: 0, until: 0 }, health: 10, heart: 30, memory: 20 },
        fragment: '満員電車と逆方向の改札を抜け、平日の午前十時の映画館に身を沈める。客席には、私のほかに三人しかいない。愛車のハンドルを握って空いた国道を走るたび、「今が一番若いのだ」という言葉が胸の奥で弾けた。',
      },
    ],
  },

  e60_invest: {
    chapter: 3, act: 2, imageId: 'img_nisa_60',
    title: '退職金と、新NISAの口座',
    body: (s, ctx) => [
      ctx.job.retire60 > 0
        ? `退職金が振り込まれ、通帳の残高は${man(s.assets)}になった。銀行の窓口では、若い行員が投資信託のパンフレットを三枚並べた。`
        : `私には退職金がない。通帳の残高は${man(s.assets)}。それでも銀行の窓口で、若い行員は投資信託のパンフレットを三枚並べた。`,
      '新NISAなら運用益に税金はかからない。全世界株式の投資信託は、過去の平均で年5%ほど。ただし、それはあくまで平均で、一年で三割下がる年もある。',
    ],
    choices: (s) => {
      const half = Math.min(1800, Math.floor((s.assets * 0.5) / 10) * 10)
      const full = Math.min(1800, Math.floor((s.assets - 300) / 10) * 10)
      return [
        {
          id: 'deposit', label: '預金のまま置いておく（増えないが減らない）', detail: '運用なし',
          fragment: '六十歳の春、退職金の振り込まれた通帳を、私はそのまま引き出しにしまった。窓口の若い行員はパンフレットをもう一度こちらへ滑らせたが、私は首を振った。増えなくていい。減らないことのほうが、この歳の私には大事に思えた。',
        },
        {
          id: 'half', label: '半分を新NISAで運用する', minAssets: 100,
          detail: `${man(half)}を全世界株式の投資信託へ（年平均5%・値動き±15%程度／運用益は非課税）`,
          effect: { invest: half },
          fragment: '六十歳の春、私は退職金の半分を新しいNISAの口座に移した。スマホの画面で「購入」のボタンを押す指先が、少しだけ震えた。年に五パーセント。それはパンフレットの中の平均であって、約束ではない。わかっていて、私は老後の一部を、世界の景気という見知らぬ海に浮かべた。',
        },
        {
          id: 'full', label: '生活費の予備300万円だけ残し、ほぼ全額を新NISAへ', minAssets: 500,
          detail: `${man(Math.max(0, full))}を投資信託へ（生涯投資枠1,800万円まで）`,
          effect: { invest: Math.max(0, full) },
          fragment: '六十歳の春、私は生活費の一年ぶんだけを手元に残し、残りのすべてをNISAに注ぎ込んだ。「時間を味方につけるんです」と、動画の中の誰かが言っていた。六十歳の私に、味方になってくれる時間がどれほど残っているのか。その計算だけは、どのアプリも教えてくれなかった。',
        },
      ]
    },
  },

  e63_illness: {
    chapter: 3, act: 2, imageId: 'img_illness_63',
    // 63歳で病に倒れる確率：基本7% ＋ 健康60未満で+6% ＋ 満身創痍(D4)で+5% ＋ 飲み続けた人は+3%
    when: (s, ctx, rand) => {
      const p = 0.07 + (s.health < 60 ? 0.06 : 0) + (ctx.body.id === 'D4' ? 0.05 : 0) + (s.flags.drinker ? 0.03 : 0)
      return rand() < p
    },
    title: '六十三歳、突然の病と「障害年金」',
    body: (s) => [
      '冬の朝、洗面所で倒れた。脳梗塞だった。命は助かったが、右手と右足に麻痺が残り、仕事はもう続けられない。',
      s.pensionAge === 60
        ? '病院の相談室で、障害年金の話が出た。けれど、あなたは60歳で年金を繰上げ受給している。繰上げたあとに初診日がある病気では、原則として障害基礎年金は請求できない。'
        : `病院の相談室で、障害年金（2級相当）を請求できると言われた。65歳まで手取りで月${DISABILITY_PENSION_MONTHLY}万円ほど。${s.pensionAge > 65 ? 'ただし障害年金を受け取る権利があると、老齢年金の繰下げは原則としてできなくなる。' : ''}`,
    ],
    choices: (s) => {
      const common = { health: -25, extraLiving: 12, work: { perYear: 0, until: 0 } }
      if (s.pensionAge === 60) {
        return [{
          id: 'accept', label: '障害年金を請求できない現実を受け止める', detail: '健康-25 / 心-15 / 仕事は続けられない / 医療費+12万/年',
          effect: { ...common, heart: -15 },
          note: '繰上げ受給をしていたため、障害基礎年金（事後重症）は請求できなかった。',
          fragment: '六十三歳の冬、私は朝の洗面所で倒れた。脳梗塞だった。右手に残った痺れのせいで、湯呑みを持つのにも左手を添えるようになった。病院の相談室で、ソーシャルワーカーは書類をめくり、申し訳なさそうに首を振った。「繰上げ受給をされているので、障害年金は請求できないんです」。三年前、窓口で丸をつけたあの欄の小さな注意書きを、私は読んだはずだった。読んだはずなのに、自分のこととは思っていなかった。',
        }]
      }
      const deferred = s.pensionAge > 65
      const list = [{
        id: 'claim', label: '障害年金を請求する',
        detail: `健康-25 / 心-10 / 65歳まで手取り月${DISABILITY_PENSION_MONTHLY}万円${deferred ? ' / 繰下げはできなくなり、老齢年金は65歳から受給に変わる' : ''}`,
        effect: { ...common, heart: -10, flags: { disabilityPension: DISABILITY_PENSION_MONTHLY }, ...(deferred ? { pensionAge: 65 } : {}) },
        note: deferred ? '障害年金を受け取ることにした。そのかわり、繰下げの計画は65歳受給に変わった。' : '障害年金を受け取ることになった。',
        fragment: `六十三歳の冬、私は朝の洗面所で倒れた。脳梗塞だった。右手に残った痺れのせいで、湯呑みを持つのにも左手を添えるようになった。病院の相談室で、ソーシャルワーカーが障害年金の書類を揃えてくれた。初診日の証明、診断書、病歴の申立書。紙の束は重かったが、それは私がまだこの社会の網の目の中にいるという、確かな手応えでもあった。${deferred ? 'そのかわり、待つと決めていた年金は、六十五歳から受け取ることになった。計画は、身体の都合で静かに書き換えられた。' : ''}`,
      }]
      if (deferred) {
        list.push({
          id: 'noclaim', label: '障害年金は請求せず、繰下げの計画を守る', detail: '健康-25 / 心-15 / 障害年金なし / 繰下げによる増額は維持',
          effect: { ...common, heart: -15 },
          note: '障害年金を請求しなかった。繰下げの計画はそのままだが、無年金の期間が続く。',
          fragment: '六十三歳の冬、私は朝の洗面所で倒れた。脳梗塞だった。相談室で障害年金の話を聞いたが、私は首を横に振った。受け取れば、繰下げの計画は崩れる。右手の痺れをさすりながら、私は通帳の数字と、これから先の十年を、何度も天秤にかけた。',
        })
      }
      return list
    },
  },

  e64_romance: {
    chapter: 3, act: 2, imageId: 'img_romance_64',
    when: (s, ctx) => !ctx.family.married,
    title: '六十四歳、思いがけない出会い',
    body: (s, ctx) => [
      `公民館の${s.flags.hobby ? '文章教室' : '健康体操の教室'}で、帰り道が同じ方向の人と、なんとなく話すようになった。${g(ctx, '同い年の、笑うと目尻に深い皺の寄る女性', '二つ年上の、穏やかに話す男性')}だった。`,
      '相手も長くひとりで暮らしてきたという。すでに年金を受け取っていて、手取りは月7万円ほど。「この歳で、また誰かと暮らすなんてね」と、その人は照れくさそうに笑った。',
    ],
    choices: () => [
      {
        id: 'marry', label: '入籍して、一緒に暮らす（熟年結婚）',
        detail: '心+25 / 思い出+10 / 相手の年金（月7万）が家計に入るが、生活費も増える / 孤独ペナルティ解消',
        effect: { heart: 25, memory: 10, extraLiving: 40, flags: { partner: 'married', partnerPension: 7 } },
        fragment: (st, c) => `六十四歳の秋、私は区役所の窓口で婚姻届を出した。証人欄には、${c.region.id === 'A1' ? '駅前の' : '近所の'}喫茶店のマスターが名前を書いてくれた。二人分の湯呑みが並ぶ食器棚を見たとき、私は自分がどれほど長く、ひとりぶんの食器だけで暮らしてきたのかを知った。遅すぎる春だと笑う人もいるだろう。けれど、春に遅すぎるということはない。`,
      },
      {
        id: 'visit', label: '籍は入れず、週末だけ行き来する「通い婚」にする',
        detail: '心+15 / 思い出+5 / 家計はそれぞれ / 孤独ペナルティ半減',
        effect: { heart: 15, memory: 5, flags: { partner: 'visit' } },
        fragment: '六十四歳の秋から、私たちは籍を入れないまま、週末だけ互いの部屋を行き来するようになった。相続のことも、年金のことも、それぞれの子や親戚のことも、そのほうが面倒が少ない。土曜の夕方、合鍵で開けたドアの向こうから煮物の匂いがしてくる。それだけで、一週間はちゃんと一週間の形になった。',
      },
      {
        id: 'alone', label: 'ありがたいが、一人の暮らしを続ける',
        detail: '変化なし',
        fragment: '六十四歳の秋、私はその人の誘いを、丁寧に断った。ひとりの暮らしには、ひとりの暮らしの静けさがある。帰り道、公民館の前の銀杏が、音もなく葉を落としていた。あの日の選択を、私は今も間違いだったとは思っていない。ただ、ときどき思い出すだけだ。',
      },
    ],
  },

  // ---- 第4章 ----
  e65_atm: {
    chapter: 4, act: 3, imageId: 'img_bankbook',
    title: '偶数月十五日、銀行ATMと「天引き通知書」の現実',
    body: (s, ctx) => {
      const row = PENSION_TABLE[s.pensionAge]
      const gross = Math.round(ctx.job.gross65 * row.grossMult * 10) / 10
      const net = Math.round(ctx.job.net65 * row.realMult * 10) / 10
      if (receiving(s)) {
        return [
          '偶数月の十五日。年金の振込日のATMには、同じ年頃の人たちが静かな列を作っていた。',
          `額面は月${gross}万円。けれど手取りは月${net}万円。介護保険料と住民税が、音もなく天引きされている。`,
        ]
      }
      return [
        '偶数月の十五日。ATMの列に並ぶ同年代の人たちを、私は少し離れたところから眺めていた。',
        `私の年金は、まだ${s.pensionAge - s.age}年先だ。無年金のまま、貯金が毎年200万円前後ずつ溶けていく。現在の資産は${man(total(s))}${s.invest > 0 ? `（うちNISA ${man(s.invest)}）` : ''}。`,
      ]
    },
    choices: () => [
      {
        id: 'close', label: '通帳を閉じて、銀行を出る', detail: '',
        fragment: (s) => receiving(s)
          ? '偶数月の十五日、ATMの前の列に並んだ。通帳を差し込むと、機械の奥でジジ、ジジと印字の音がする。額面より確かに少ない数字が、そこに刻まれていた。介護保険料、住民税。見えない誰かが、私の年金を少しずつ齧っていく。それでも、働かずに振り込まれるお金の重みは、不思議と掌に温かかった。'
          : '偶数月の十五日、ATMの列に並ぶ同年代の人たちを、私は銀行の外から眺めていた。私の通帳には、まだ何も振り込まれない。記帳するたびに、残高の数字だけが一段ずつ低くなっていく。機械の印字の音が、砂時計の砂の落ちる音に聞こえた。',
      },
    ],
  },

  e67_winter: {
    chapter: 4, act: 3, imageId: 'img_travel_67',
    title: '六十七歳・冬の早朝ワークか、動けるうちの最後の遠出か',
    body: () => [
      '六十七歳。身体はまだ、なんとか言うことを聞いてくれる。',
      '貯金を守るか、思い出を買うか。どちらも、いましかできないことだった。',
    ],
    choices: (s, ctx) => {
      const cost = s.flags.downsized ? 80 : 120
      const bonus = ctx.married ? 5 : 0
      return [
        {
          id: 'travel', label: '貯金を切り崩して、憧れの場所へ長期旅行に出る', requiresHealth: true, minHealth: 50,
          detail: `資産-${cost}万 / 心+${35 + bonus} / 思い出+30${bonus ? '（夫婦旅行ボーナス）' : ''}`,
          imageId: 'img_travel_67',
          effect: { assets: -cost, heart: 35 + bonus, memory: 30 },
          fragment: (st, c) => `六十七歳の秋、まだ自分の足で階段を駆け上がれるうちに、と遠くの海へ旅に出た。${c.married ? `旅館の窓辺で、${spouse(c)}が「来てよかったね」と小さく言った。` : ''}潮風に吹かれながら食べた刺身の歯ごたえと、水平線に沈む夕日の眩しさ。あの数日は、一生消えない宝石になった。`,
        },
        {
          id: 'work', label: '老後資金を守るため、早朝の清掃・警備パートに出て節約する', detail: '資産+350万（3年間） / 健康-15 / 心-10',
          imageId: 'img_work_65_senior',
          effect: { work: { perYear: 117, until: 70 }, health: -15, heart: -10 },
          fragment: (st, c) => `六十七歳の冬、朝六時の蛇口から出る水は、針のように冷たかった。腰に貼ったサロンパスの匂いをさせながら、マンションの植え込みの落ち葉を掃く。そんな私を救ってくれたのは、登校する小学生の「${g(c, 'おじちゃん', 'おばちゃん')}、おはよう！」という白い息だけだった。`,
        },
        {
          id: 'tv', label: 'お金を使わないよう、家でテレビとスーパーの半額シールを追う', detail: '資産-30万 / 健康-10 / 心-15',
          effect: { assets: -30, health: -10, heart: -15 },
          fragment: '六十七歳の冬、私はお金を使わないことに一日を費やした。昼のワイドショーを眺め、夕方にはスーパーの半額シールが貼られる時刻を待つ。節約は確かに通帳を守った。けれど、その冬を思い出そうとしても、テレビの青白い光しか浮かんでこない。',
        },
      ]
    },
  },

  e68_crash: {
    chapter: 4, act: 3, imageId: 'img_crash_68',
    when: (s) => s.invest > 0,
    title: '六十八歳、世界同時株安',
    body: (s) => [
      'ある朝のニュースが、世界の株価がこの一年で三割下がったと告げていた。アナウンサーの声は、いつもより少しだけ早口だった。',
      `NISAの評価額は${man(s.invest)}から、およそ${man(s.invest * 0.7)}へ。（投資した元本は${man(s.investPrincipal)}）`,
    ],
    choices: (s) => {
      const buy = Math.min(300, Math.floor((s.assets - 100) / 10) * 10)
      const list = [
        {
          id: 'hold', label: '何もせず、持ち続ける', detail: '評価額-30%のまま耐える',
          effect: { investMult: 0.7, flags: { recoveryYears: 2 } },
          note: '評価額は三割下がった。ここから戻るかどうかは、誰にもわからない。',
          fragment: '六十八歳の冬、ニュースは連日、株価の暴落を伝えていた。アプリを開くと、評価額の数字が赤く染まっている。私はそっとアプリを閉じ、スマホを伏せて、台所でお湯を沸かした。やかんが鳴るまでの数分間、何もしないことが、こんなにも難しいとは思わなかった。',
        },
        {
          id: 'sell', label: '怖くなって、全部売って現金に戻す', detail: '-30%で損失を確定。以後は運用なし / 心+5',
          effect: { investMult: 0.7, sellAll: true, heart: 5, flags: { panicSold: true } },
          note: '損失が確定した。そのかわり、もう値動きに眠れない夜はない。',
          fragment: '六十八歳の冬、私は耐えきれずに、すべての投資信託を売った。損失の確定した数字を見て、不思議と胸が軽くなった。もう眠れない夜を過ごさなくていい。けれど翌年の春、株価が静かに戻り始めたというニュースを、私は少し離れたところから聞いていた。',
        },
      ]
      if (buy >= 50) {
        list.push({
          id: 'buy', label: '安くなった今こそ、手元の現金で買い増す', detail: `評価額-30% ＋ 現金から${man(buy)}を追加投資`,
          effect: { investMult: 0.7, invest: buy, flags: { recoveryYears: 2 } },
          note: '安値で買い増した。吉と出るかは、まだわからない。',
          fragment: '六十八歳の冬、誰もが売りに走る画面を見ながら、私はなけなしの現金で買い増しのボタンを押した。安売りの日にこそ買う。八百屋の店先なら当たり前のことが、数字の上ではこんなにも怖い。押したあと、私はしばらく自分の手のひらを眺めていた。',
        })
      }
      return list
    },
  },

  // ---- 第5章 ----
  e70_premium: {
    chapter: 5, act: 4, imageId: 'img_bankbook',
    title: '七十歳、跳ね上がる保険料と窓口負担',
    body: (s, ctx) => {
      const net = Math.round(ctx.job.net65 * PENSION_TABLE[s.pensionAge].realMult * 10) / 10
      if (s.pensionAge === 70) return ['七十歳の誕生月、待ちに待った年金が初めて振り込まれた。', `手取りで月${net}万円。ただし介護保険料の等級も、きっちり一段上がっていた。`]
      if (s.pensionAge === 75) return ['七十歳。私の通帳には、まだ年金の文字がない。あと五年。', '病院の窓口負担が二割になり、薬局の袋が少しずつ厚くなる。']
      return ['七十歳。病院の窓口で払う負担が変わった。', '処方箋の束は、いつの間にか厚くなっていた。']
    },
    choices: (s, ctx) => [
      {
        id: 'onsen', label: `${ctx.married ? '夫婦で' : 'ひとりで'}近場の温泉に一泊する`, requiresHealth: true,
        detail: '資産-15万 / 心+12 / 思い出+8',
        effect: { assets: -15, heart: 12, memory: 8 },
        fragment: (st) => `${PREFIX_70[st.pensionAge]}その秋、近くの温泉に一泊した。湯船の縁に頭を預けると、天井の湯気の向こうで、裸電球がぼんやりと滲んでいる。七十という数字が、湯の中では少しだけ軽くなった。`,
      },
      {
        id: 'walk', label: '週二回の散歩とラジオ体操を日課にする', detail: '健康+6 / 心+3',
        effect: { health: 6, heart: 3 },
        fragment: (st) => `${PREFIX_70[st.pensionAge]}私は朝のラジオ体操に通い始めた。公園の砂利を踏む音、首に掛けた出席カードのスタンプ。ぎこちなく腕を回す老人たちの影が、朝日の中で長く伸びていた。`,
      },
    ],
  },

  e72_wall: {
    chapter: 5, act: 4, imageId: 'img_health_wall_72',
    title: '【運命の審判】七十二歳の朝、身体の異変',
    body: (s, ctx) => [
      '七十二歳の、ある冬の朝。目覚まし時計が鳴る前に、私は目を覚ました。',
      `あなたの地域の健康寿命は${ctx.life.healthy}歳。いまの健康値は${Math.round(s.health)}。壁を越えられる確率は、およそ${ctx.wallProb}%。`,
    ],
    choices: () => [
      {
        id: 'wake', label: '布団から起き上がる', detail: '健康寿命の判定を行う',
        resolve: (s, ctx, r) => {
          const passed = r * 100 < ctx.wallProb
          if (passed) {
            return {
              effect: { heart: 5, flags: { wallPassed: true } },
              note: `壁を越えた（突破確率 ${ctx.wallProb}%）。身体はまだ、あなたのものだ。`,
              fragment: (st) => `七十二歳の冬の朝、目覚めると、窓の外がうっすらと白んでいた。私は布団の中で、そっと足の指を動かしてみた。一本ずつ、ちゃんと応える。起き上がり、冷たい廊下を歩いて台所に立つ。やかんに水を汲む音が、こんなにも澄んで聞こえたのは初めてだった。${st.flags.gym ? 'あの日のスニーカーの汗が、遠いところから私を押し上げてくれた気がした。' : '理由はわからない。ただ、運が良かっただけなのかもしれない。'}`,
            }
          }
          return {
            effect: { health: -15, heart: -10, flags: { mobilityLimited: true } },
            note: `健康寿命の壁に激突した（突破確率 ${ctx.wallProb}%）。以後、旅行やドライブなどの選択肢はロックされ、医療・介護費が年24万円増える。`,
            fragment: (st) => `七十二歳の冬の朝、起き上がろうとして、腰から下が自分のものではないような感覚に襲われた。畳に手をつき、壁を伝って、ようやく立ち上がる。台所までの数メートルが、遠い国境のように長かった。窓の外では、何も知らない雀が、電線の上で冬の光を浴びていた。${st.flags.drinker ? 'あの秋、開かなかった封筒のことを、私はふと思い出した。' : ''}`,
          }
        },
      },
    ],
  },

  // ---- 第6章 ----
  e75_late: {
    chapter: 6, act: 5, imageId: 'img_late_75_home',
    title: '七十五歳、後期高齢者と「修繕費爆弾」',
    body: (s, ctx) => {
      const lines = []
      if (s.pensionAge === 75) lines.push(`ついに、+84%の年金の振込が始まる。手取りで月${Math.round(ctx.job.net65 * 1.641 * 10) / 10}万円。`)
      if (ctx.family.owned) lines.push('同じ週に、屋根の雨漏りと給湯器の故障が重なった。業者の見積もりは150万円。')
      else lines.push('後期高齢者医療制度の、薄い水色の保険証が届いた。')
      return lines
    },
    choices: (s, ctx) => [
      ctx.family.owned
        ? {
          id: 'repair', label: '見積書に判を押す', detail: '資産-150万（持ち家の修繕は避けられない）',
          effect: { assets: -150 },
          fragment: (st) => `${st.pensionAge === 75 ? PREFIX_75 : ''}七十五歳の梅雨、天井の染みがじわじわと広がり、同じ週に給湯器が止まった。業者の見積書には百五十万円とあった。私は判を押しながら、この家が私と同じ速さで老いていたことを知った。${total(st) < 0 ? '通帳の残高は、その日、ついにマイナスの領域へ足を踏み入れた。' : ''}`,
        }
        : {
          id: 'card', label: '保険証を財布にしまう', detail: '',
          fragment: (st) => `${st.pensionAge === 75 ? PREFIX_75 : ''}七十五歳の誕生日、薄い水色の保険証が届いた。後期高齢者、という言葉の硬さに、私はしばらく封筒を開けられなかった。`,
        },
    ],
  },

  e77_license: {
    chapter: 6, act: 5, imageId: 'img_license_77',
    title: '七十七歳、運転免許証の返納問題',
    body: (s, ctx) => [
      '七十七歳。高齢者講習の認知機能検査は、なんとか通った。けれど、駐車場で白線をはみ出すことが増えた。',
      ctx.region.licensePenalty === 0
        ? 'この街なら、電車もバスも数分おきに来る。'
        : 'この町では、車がなければスーパーにも病院にも行けない。',
    ],
    choices: (s, ctx) => {
      const scale = ctx.family.condo ? 0.5 : 1
      const pen = ctx.region.licensePenalty * scale
      return [
        {
          id: 'return', label: '免許を返納する',
          detail: pen === 0 ? '都市部なので暮らしへの影響はほぼない' : `心${pen} / 健康${Math.round(pen / 2)}${scale < 1 ? '（マンション暮らしでダメージ半減）' : ''}`,
          effect: { heart: pen, health: pen / 2, flags: { licenseReturned: true } },
          fragment: pen === 0
            ? '七十七歳の春、警察署の窓口で免許証を返した。かわりに受け取った運転経歴証明書は、思ったより軽かった。駅まで歩けば、電車は数分おきに来る。私の暮らしは、何も変わらなかった。'
            : '七十七歳の春、警察署の窓口で免許証を返した。帰り道、一時間に一本のバスを待つあいだ、私は四十年以上握ってきたハンドルの感触を、掌の中で何度も確かめた。スーパーは、急に遠い町になった。',
        },
        {
          id: 'drive', label: 'まだ運転を続ける', detail: '30%の確率で物損事故（資産-100万）',
          resolve: (st, c, r) => {
            const risk = st.flags.mobilityLimited ? 0.45 : 0.3
            if (r < risk) {
              return {
                effect: { assets: -100, heart: -10 },
                note: '物損事故を起こした。資産-100万。',
                fragment: '七十七歳の秋、スーパーの駐車場で、アクセルとブレーキを踏み違えた。鈍い音がして、車止めのブロックが砕けた。幸い、誰も怪我はしなかった。修理代と賠償の百万円より、震えの止まらない自分の膝のほうが、ずっと怖かった。',
              }
            }
            return {
              effect: { heart: 5 },
              note: '今回は何事もなかった。',
              fragment: '七十七歳の秋も、私はまだハンドルを握っていた。速度を落とし、早めにウインカーを出し、夜は運転しない。窓を少し開けると、刈り入れの終わった田んぼの匂いがした。この匂いを、あと何回嗅げるだろうか。',
            }
          },
        },
      ]
    },
  },

  e78_daily: {
    chapter: 6, act: 5, imageId: 'img_late_75_home',
    title: '「きょういく（今日行く所）」と「きょうよう（今日の用事）」',
    body: () => [
      '七十八歳。老後を元気に過ごすには「教育」と「教養」が要る、と誰かが言った。今日行く所と、今日の用事のことだ。',
      '時間だけは、いくらでもあった。',
    ],
    choices: () => [
      {
        id: 'cafe', label: '地元の喫茶店モーニングや、デジタル創作（小説・俳句・音楽）を日課にする', detail: '資産-40万 / 心+25',
        effect: { assets: -40, heart: 25 },
        fragment: (st) => `七十八歳の私の一日は、喫茶店のモーニングから始まる。厚切りのトーストにバターが溶けていく匂い。マスターは何も聞かずに、いつもの珈琲を置いてくれる。午後はタブレットを開いて、${st.flags.hobby ? '五十四の春から書き続けてきた文章の続き' : '覚えたばかりの俳句'}を打ち込んだ。今日行く所があり、今日の用事がある。それだけで、一日はちゃんと一日の形になった。`,
      },
      {
        id: 'trip', label: 'もう一度、遠くの町まで旅をする', requiresHealth: true, detail: '資産-80万 / 心+30 / 思い出+10',
        effect: { assets: -80, heart: 30, memory: 10 },
        fragment: '七十八歳の夏、私はもう一度、遠くの町まで旅をした。杖は持っていったけれど、一度も使わなかった。若い頃のようには歩けない。そのぶん、駅前の古い食堂の暖簾の色や、川面に跳ねる光を、ゆっくりと眺めることができた。',
      },
      {
        id: 'tv', label: '暖房費と外出費をケチり、一日中テレビの通販番組を眺めて過ごす', detail: '資産±0 / 健康-15 / 心-25',
        effect: { health: -15, heart: -25 },
        fragment: '暖房の設定温度を十八度に下げ、私は一日中、炬燵に入って通販番組を眺めた。画面の中では、誰かがいつも驚いて、いつも喜んでいる。夕方、カーテンの隙間から西日が差して、写真立ての埃を照らした。その日、私は誰とも、一言も話さなかった。',
      },
    ],
  },

  // ---- 最終章 ----
  e82_housing: {
    chapter: 7, act: 5, imageId: 'img_final_85',
    title: '八十二歳、損益分岐点と住まいの終着駅',
    body: (s) => [
      '八十二歳。年金事務所から届いた「ねんきん定期便」の累計欄を、私は虫眼鏡で読んだ。',
      `これまでに受け取った年金の手取り累計は${Math.round(s.cumPension).toLocaleString()}万円。いまの資産は${man(total(s))}。65歳・70歳受給組の累計が、ついに60歳受給組を追い抜く頃だ。`,
    ],
    choices: (s, ctx) => [
      {
        id: 'care', label: '見晴らしの良いケア付き高齢者住宅に移る', minAssets: 1500, detail: '入居一時金-500万 / 生活費+40万/年 / 心+15',
        effect: { assets: -500, heart: 15, extraLiving: 40, flags: { housing: 'care' } },
        fragment: `八十二歳の春、私は見晴らしのいいケア付きの住宅に移った。荷物は段ボール八箱に収まった。新しい部屋の窓からは、${ctx.region.motif}が見える。夜中に呼び鈴を押せば、誰かが来てくれる。その安心を、私は通帳の数字と引き換えに手に入れた。`,
      },
      {
        id: 'stay', label: '住み慣れた家（部屋）に残る', detail: total(s) < 300 ? '資産が心細い。節約生活になる' : '資産±0',
        resolve: (st) => (total(st) < 300
          ? {
            effect: { heart: -5, flags: { housing: 'drafty' } },
            fragment: '八十二歳の春、私の部屋には隙間風が吹いていた。灯油の残量を確かめながら、ストーブを一時間だけ点ける。毛布を肩までかぶると、どこか遠くで、まだ若かった頃の自分が笑っているような気がした。',
          }
          : {
            effect: { heart: 5, flags: { housing: 'home' } },
            fragment: ctx.family.rent
              ? '八十二歳の春も、私は同じ古いアパートにいた。大家は二代目に代わったが、窓から見える電線と空の形は変わらない。この六畳が、私の終着駅だ。'
              : '八十二歳の春も、私は住み慣れた家にいた。柱には子どもの背丈を刻んだ傷が残り、台所の床は、私の歩く場所だけ艶が落ちている。この家が、私の終着駅だ。',
          }),
      },
    ],
  },
}

const PENSION_FRAGMENTS = {
  60: '六十歳の春、私は窓口で「六十歳から」の欄に丸をつけた。生涯の受取額が二割以上減ると、職員は丁寧に二度説明した。それでも私は頷いた。減るのは数字で、増えるのは時間だ。帰り道の桜並木の下で、まだ軽く動く自分の脚を、私は少し誇らしく思った。',
  65: '六十歳の春、私は結局、いちばん普通の「六十五歳から」を選んだ。増やしもせず、減らしもしない。役所の白い封筒を鞄にしまうと、少しだけ肩の荷が下りた。平凡を選ぶのにも勇気が要るのだと、その日の夕焼けが教えてくれた。',
  70: '六十歳の春、私は「七十歳まで待つ」と決めた。一・四二倍。電卓を叩くたびに、その数字は私を励ました。ただ、十年という時間の長さだけは、どの電卓にも表示されなかった。窓口の職員が差し出したボールペンは、思ったより冷たかった。',
  75: '六十歳の春、私は「七十五歳まで待つ」という、いちばん遠い欄に丸をつけた。一・八四倍。八十代で金が尽きる恐怖から、私は自分を守りたかった。窓口を出ると、春の風が書類の端をめくった。十五年。その歳月の向こう岸は、霞んでまったく見えなかった。',
}

const SPOUSE_FRAGMENTS = {
  60: (ctx, s) => `${spouse(ctx)}の年金は、六十歳から受け取ることにした。少し減っても、${s.pensionAge > 60 ? '私の年金が始まるまでの谷間を、二人で渡りきるための橋になる。' : '二人とも早く受け取って、動けるうちに使えばいい。'}食卓で電卓を叩く私の横で、${spouse(ctx)}は「${g(ctx, 'どっちでもいいわよ、あなたが決めて', 'どっちでもいいよ、お前が決めてくれ')}」と笑った。`,
  65: (ctx) => `${spouse(ctx)}の年金は、普通に六十五歳から受け取ることにした。夫婦で別々の数字を選ぶほどの度胸は、私たちにはなかった。それでいいのだと思う。`,
  70: (ctx) => `${spouse(ctx)}の年金は、七十歳まで待つことにした。${spouse(ctx)}のほうが長生きする家系だから、と二人で笑った。その笑いの奥に、どちらかが先に逝く日のことが、薄く透けて見えた。`,
}

const PREFIX_70 = {
  60: '七十歳になると、病院の窓口で払う負担が変わった。',
  65: '七十歳になると、病院の窓口で払う負担が変わった。',
  70: '七十歳の誕生月、待ちに待った年金が初めて振り込まれた。通帳に並んだ数字は、十年待った私への勲章のように見えた。ただ、そのすぐ下には、跳ね上がった介護保険料の天引きが、ぴたりと寄り添っていた。',
  75: '七十歳になっても、私の通帳にはまだ年金の文字がない。あと五年。病院の窓口で払う二割の負担が、じわじわと残高を削っていく。',
}

const PREFIX_75 = 'そして七十五歳、待ち続けた年金がついに振り込まれた。十五年。通帳に刻まれた数字は、確かに誰よりも大きかった。けれど、ATMの画面のその数字を読むのに、私はもう眼鏡が要った。'
