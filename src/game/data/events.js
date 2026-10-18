// 50歳〜85歳の年代別イベントと小説フラグメント（SPEC.md 第6章）
// effect の単位: assets=万円 / health・heart・memory=ポイント
// fragment は文字列、または (state, ctx) => 文字列。効果を適用した後に評価される。
import {
  PENSION_TABLE, DISABILITY_PENSION_MONTHLY, STROKE_RATE_60S, CARE_RATE_74, CARE_RATE_79, CARE_COST, DOG_LIFESPAN,
  ABROAD_INVITE_RATE,
} from './tables.js'
import { HOBBY_EVENTS } from './hobbies.js'

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
  { type: 'event', id: 'e58_dog', age: 58 },
  { type: 'chapter', chapter: 3, age: 60 },
  { type: 'event', id: 'e60_pension', age: 60 },
  { type: 'event', id: 'e60_spouse', age: 60 },
  { type: 'event', id: 'e60_work', age: 60 },
  { type: 'event', id: 'e60_invest', age: 60 },
  { type: 'event', id: 'e61_hobby', age: 61 },
  { type: 'reunion', age: 62, act: 2, imageId: 'img_reunion_62', title: '六十二歳の同窓会', place: '駅前の居酒屋「ほたる」' },
  { type: 'event', id: 'e63_illness', age: 63 },
  { type: 'event', id: 'e64_romance', age: 64 },
  { type: 'chapter', chapter: 4, age: 65 },
  { type: 'event', id: 'e65_atm', age: 65 },
  { type: 'event', id: 'e65_abroad', age: 65 },
  { type: 'event', id: 'e66_hobby', age: 66 },
  { type: 'event', id: 'e67_winter', age: 67 },
  { type: 'event', id: 'e68_crash', age: 68 },
  { type: 'event', id: 'e69_community', age: 69 },
  { type: 'chapter', chapter: 5, age: 70 },
  { type: 'event', id: 'e70_premium', age: 70 },
  { type: 'event', id: 'e70_cruise', age: 70 },
  { type: 'event', id: 'e71_dog', age: 71 },
  { type: 'event', id: 'e72_wall', age: 72 },
  { type: 'reunion', age: 73, act: 4, imageId: 'img_reunion_73', title: '七十三歳の同窓会', place: '雨の午後の和食店' },
  { type: 'event', id: 'e74_care', age: 74 },
  { type: 'event', id: 'e74_hobby', age: 74 },
  { type: 'chapter', chapter: 6, age: 75 },
  { type: 'event', id: 'e75_late', age: 75 },
  { type: 'event', id: 'e75_return', age: 75 },
  { type: 'event', id: 'e76_school', age: 76 },
  { type: 'event', id: 'e77_license', age: 77 },
  { type: 'event', id: 'e78_daily', age: 78 },
  { type: 'event', id: 'e79_care', age: 79 },
  { type: 'event', id: 'e79_stage', age: 79 },
  { type: 'chapter', chapter: 7, age: 80 },
  { type: 'event', id: 'e82_housing', age: 82 },
  { type: 'reunion', age: 82, act: 5, imageId: 'img_reunion_82', title: '八十二歳、最後の同窓会', place: 'ホテルのティーラウンジ' },
  { type: 'event', id: 'e83_days', age: 83 },
  { type: 'ending', age: 85 },
]

const receiving = (s) => s.pensionAge && s.age >= s.pensionAge
const livingAbroad = (s) => !!s.flags.abroad && !s.flags.returned
const total = (s) => s.assets + (s.invest || 0)
const man = (v) => `${Math.round(v).toLocaleString()}万円`

export const EVENTS = {
  ...HOBBY_EVENTS,

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

  e58_dog: {
    chapter: 2, act: 1, imageId: 'img_dog_58',
    title: '五十八歳、保護犬の譲渡会',
    body: () => [
      '日曜日の公園で、保護犬の譲渡会が開かれていた。ケージの中から、片耳だけ折れた茶色い雑種が、じっとこちらを見ている。二歳くらいだという。',
      `犬の平均寿命は約${DOG_LIFESPAN}歳（ペットフード協会 2024年）。迎えれば、七十代のはじめまで一緒に暮らすことになる。東京都健康長寿医療センターなどの研究では、犬を飼っている高齢者は認知症の発症リスクが約4割低かった（散歩や人との交流が増えるためと考えられている。観察研究なので因果関係までは断定できない）。`,
    ],
    choices: () => [
      {
        id: 'adopt', label: 'この子を家族に迎える', detail: '餌代・医療費などで生活費+15万/年（目安） / 心+12 / 思い出+8 / 散歩で健康が保たれやすい・孤独がやわらぐ',
        effect: { heart: 12, memory: 8, extraLiving: 15, flags: { dog: 'alive' } },
        fragment: '五十八歳の秋、保護犬の譲渡会で、一匹の雑種と目が合った。片耳だけ折れた、茶色い二歳の犬だった。名前は「こむぎ」にした。翌朝から、私の一日は、散歩のリードを握るところから始まるようになった。',
      },
      {
        id: 'nodog', label: '最後まで面倒を見られるか自信がなく、見送る', detail: '変化なし',
        fragment: '五十八歳の秋、保護犬の譲渡会で、片耳の折れた茶色い犬と目が合った。十数年先の自分の身体を思うと、私はリードを受け取る勇気が出なかった。帰り道、なぜか何度も後ろを振り返った。',
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
    // 60〜64歳の脳卒中罹患率は年149.9人/10万人（福島県循環器疾患発症登録 2020年）。5年分で約0.75%
    when: (s, ctx, rand) => rand() < STROKE_RATE_60S,
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
          id: 'work', label: '老後資金を守るため、早朝の清掃や警備・交通誘導のアルバイトに出る', detail: '資産+350万（3年間） / 健康-15 / 心-10',
          imageId: 'img_work_65_senior',
          effect: { work: { perYear: 117, until: 70 }, health: -15, heart: -10 },
          fragment: (st, c) => (c.job.id === 'B1'
            ? '六十七歳の冬、私は道路工事の現場で、赤い誘導灯を振っていた。十年前まで、私は役員会議室の楕円のテーブルで、何億円という数字に判を押していた。今は、ダンプカーの運転手に頭を下げ、歩行者に「ご迷惑をおかけします」と声をかける。最初の一週間は、知っている顔に会わないかと、ヘルメットを目深にかぶった。けれど、通りがかりの老人が「寒いのにご苦労さん」と缶コーヒーを差し出してくれた夜、肩書きのない自分の手のひらが、思ったより温かいことを知った。'
            : `六十七歳の冬、朝六時の蛇口から出る水は、針のように冷たかった。腰に貼ったサロンパスの匂いをさせながら、マンションの植え込みの落ち葉を掃く。そんな私を救ってくれたのは、登校する小学生の「${g(c, 'おじちゃん', 'おばちゃん')}、おはよう！」という白い息だけだった。`),
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

  e71_dog: {
    chapter: 5, act: 4, imageId: 'img_dog_71',
    when: (s) => s.flags.dog === 'alive',
    title: '七十一歳、こむぎの介護',
    body: () => [
      'こむぎは十五歳になった。犬の平均寿命を少し越えた。後ろ足が立たなくなり、夜中に暗闇の中で細く鳴くようになった。',
      'おむつ、床ずれを防ぐマット、二時間おきの寝返り。犬の介護は、人の介護とよく似ている。',
    ],
    choices: () => [
      {
        id: 'athome', label: '居間に布団を移し、最期まで自分で看る', detail: '資産-15万 / 健康-8（睡眠不足） / 心-5 / 思い出+15',
        effect: { assets: -15, health: -8, heart: -5, memory: 15, extraLiving: -15, flags: { dog: 'passed' } },
        fragment: '七十一歳の冬、こむぎは後ろ足で立てなくなった。夜中になると、暗闇の中で細く鳴く。私は居間に布団を移し、こむぎの隣で眠った。二時間おきに体の向きを変え、おむつを替え、スポイトで水を飲ませる。春の終わり、こむぎは私の膝の上で、静かに息を引き取った。十三年分の散歩道が、その小さな体の温もりの中に、まだ残っていた。',
      },
      {
        id: 'withhelp', label: '動物病院の預かりやペットシッターにも頼りながら看る', detail: '資産-35万 / 健康-3 / 心-5 / 思い出+12',
        effect: { assets: -35, health: -3, heart: -5, memory: 12, extraLiving: -15, flags: { dog: 'passed' } },
        fragment: '七十一歳の冬、こむぎの介護が始まった。私ひとりでは夜を越えられず、ときどき動物病院に預け、ペットシッターにも来てもらった。後ろめたさがなかったと言えば嘘になる。けれど、そうして眠れた夜があったから、最期の朝、私は穏やかな顔でこむぎを撫でてやることができた。',
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
            fragment: (st) => `七十二歳の冬の朝、起き上がろうとして、腰から下が自分のものではないような感覚に襲われた。畳に手をつき、壁を伝って、ようやく立ち上がる。台所までの数メートルが、遠い国境のように長かった。窓の外では、何も知らない雀が、電線の上で冬の光を浴びていた。${st.flags.drinker ? 'あの秋、開かなかった封筒のことを、私はふと思い出した。' : ''}${st.flags.community ? 'その日の昼、回覧板を届けに来た隣家の人が、いつもと違う私の声に気づいて、すぐに救急車を呼んでくれた。溝掃除のたびに交わしてきた立ち話が、私を拾い上げてくれたのだ。' : ''}`,
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
    when: (s) => !livingAbroad(s),
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
        id: 'library', label: '毎朝、図書館に通う（新聞と雑誌、顔なじみとの会釈）', detail: '資産±0 / 心+12',
        effect: { heart: 12 },
        fragment: '七十八歳の私は、毎朝十時、開館と同時に図書館に入る。新聞閲覧台の右から二番目が、いつの間にか私の席になった。隣の席の男と、言葉を交わしたことは一度もない。けれど、彼が三日来なかった日、私はなんだか落ち着かず、四日目に姿を見たとき、思わず会釈をした。行く場所があるということは、待っていてくれる椅子があるということだった。',
      },
      {
        id: 'tv', label: '暖房費と外出費をケチり、一日中テレビの通販番組を眺めて過ごす', detail: '資産±0 / 健康-15 / 心-25',
        effect: { health: -15, heart: -25 },
        fragment: '暖房の設定温度を十八度に下げ、私は一日中、炬燵に入って通販番組を眺めた。画面の中では、誰かがいつも驚いて、いつも喜んでいる。夕方、カーテンの隙間から西日が差して、写真立ての埃を照らした。その日、私は誰とも、一言も話さなかった。',
      },
    ],
  },

  e74_care: spouseCareEvent(74, CARE_RATE_74, 'img_care_74', 5, 4),
  e79_care: spouseCareEvent(79, CARE_RATE_79, 'img_care_74', 6, 5),

  // ---- 最終章 ----
  e82_housing: {
    chapter: 7, act: 5, imageId: 'img_final_85',
    when: (s) => !livingAbroad(s),
    title: '八十二歳、損益分岐点と住まいの終着駅',
    body: (s) => [
      '八十二歳。年金事務所から届いた「ねんきん定期便」の累計欄を、私は虫眼鏡で読んだ。',
      `これまでに受け取った年金の手取り累計は${Math.round(s.cumPension).toLocaleString()}万円。いまの資産は${man(total(s))}。65歳・70歳受給組の累計が、ついに60歳受給組を追い抜く頃だ。`,
    ],
    choices: (s, ctx) => (ctx.family.rent && s.flags.partner !== 'married' && total(s) < 0 ? [
      {
        id: 'capsule', label: '家賃が払えずアパートを出て、カプセルホテルで寝泊まりする', detail: '健康-10 / 心-20',
        effect: { health: -10, heart: -20, flags: { housing: 'capsule' } },
        fragment: '八十二歳の春、私は家賃を三か月滞納し、古いアパートを出た。高齢の単身者に部屋を貸してくれる不動産屋は、どこにもなかった。駅裏のカプセルホテルの、二段目の箱が、今の私の住まいだ。荷物は紙袋二つ。夜、隣の箱から聞こえるいびきに、なぜか少しだけ安心する。昼間は図書館とコインランドリーを行き来し、閉館の音楽が流れると、また箱へ戻る。',
      },
      {
        id: 'welfare', label: '市役所の福祉課に相談し、生活保護（住宅扶助）を申請する', detail: '心-5 / 住まいは確保される',
        effect: { heart: -5, flags: { housing: 'welfare', safetyNet: true } },
        fragment: '八十二歳の春、私は市役所の福祉課の窓口に座った。恥ずかしいと思っていた。けれど担当のケースワーカーは、私の話を最後まで遮らずに聞き、「申請は国民の権利ですから」と静かに言った。住宅扶助で借りられる小さな部屋が見つかったのは、それから一か月後のことだ。日当たりの悪い一階の部屋だったが、鍵を回したとき、私は自分の家に帰ってきたのだと思った。',
      },
    ] : [
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
    ]),
  },
}

// 70歳：世界一周クルーズ（無理して行く「あるある」。成功も失敗もある）
// 途中下船の確率は健康値にもとづくゲーム上の想定（公的な統計はない）
EVENTS.e70_cruise = {
  chapter: 5, act: 4, imageId: 'img_cruise_70',
  when: (s) => !livingAbroad(s) && total(s) >= 300,
  title: '七十歳、世界一周の船旅のパンフレット',
  body: (s, ctx) => [
    '新聞の折り込みに、世界一周クルーズのパンフレットが入っていた。約100日で、アジア、中東、地中海、大西洋を巡る。客室によって費用は大きく違うが、ひとり三百万円前後の部屋が多い。',
    `「動けるうちに」と思う気持ちと、「この歳で百日も船の上で大丈夫か」という不安が、半々だった。${ctx.married ? `${spouse(ctx)}は、パンフレットの地中海の写真を、ずっと指でなぞっていた。` : ''}`,
  ],
  choices: (s, ctx) => {
    const cost = ctx.married ? 600 : 300
    return [
      {
        id: 'world', label: `思い切って、世界一周クルーズ（約100日）に申し込む${ctx.married ? '（夫婦で）' : ''}`, requiresHealth: true,
        minAssets: cost + 100, lockReason: `旅費（${cost}万円前後）と予備のお金が足りない`,
        detail: `資産-${cost}万 / 体調しだいで途中下船もありうる`,
        resolve: (st, c, r) => {
          const failRate = st.health >= 70 ? 0.05 : st.health >= 50 ? 0.12 : 0.3
          if (r < failRate) {
            return {
              effect: { assets: -cost - 150, health: -10, heart: -10, memory: 12 },
              note: `体調を崩して途中下船した（この健康状態での想定確率 ${Math.round(failRate * 100)}%）。現地の入院費と帰国の航空券で、さらに150万円かかった。`,
              fragment: '七十歳の春、私は世界一周の船に乗った。けれど出航から三週間、インド洋の上で高い熱が出た。船医の判断で、私はスリランカの港で船を降りた。現地の病院の天井で回る大きな扇風機を、私は四日間、ただ見上げていた。帰国の飛行機の窓から見えた雲の海は、あの船から見るはずだった海よりも、ずっと遠く白かった。それでも、出航の日の紙テープの色だけは、今も鮮やかに覚えている。',
            }
          }
          return {
            effect: { assets: -cost, heart: 40, memory: 40 },
            note: `無事に世界を一周した（この健康状態での途中下船の想定確率 ${Math.round(failRate * 100)}%）。`,
            fragment: `七十歳の春、私は世界一周の船に乗った。${c.married ? `${spouse(c)}と並んで` : ''}甲板の手すりにもたれ、百日のあいだに、地図でしか知らなかった名前の港をいくつも過ぎた。スエズ運河の両岸に続く砂漠、地中海の白い家並み、大西洋の夜空を埋め尽くす星。帰国して自分の布団に横になると、身体はまだ、ゆるやかに揺れていた。その揺れは、何週間も消えなかった。`,
          }
        },
      },
      {
        id: 'short', label: '国内の数泊のクルーズにしておく', detail: '資産-40万 / 心+15 / 思い出+12',
        effect: { assets: -40, heart: 15, memory: 12 },
        fragment: '七十歳の秋、私は四泊五日の国内クルーズに乗った。瀬戸内の島影が、ゆっくりと窓の外を流れていく。世界一周ではなかったけれど、夜の甲板で潮風に吹かれながら飲んだ一杯の水割りは、十分に遠くまで私を運んでくれた。',
      },
      {
        id: 'nocruise', label: 'パンフレットを閉じる', detail: '変化なし',
        fragment: null,
      },
    ]
  },
}

// 69歳：自治会と地域の見守り
EVENTS.e69_community = {
  chapter: 4, act: 3, imageId: 'img_community_69',
  when: (s) => !livingAbroad(s),
  title: '六十九歳、自治会の班長が回ってきた',
  body: () => [
    '玄関のチャイムが鳴り、前の班長が分厚いファイルを抱えて立っていた。「来年度、お願いできますか」。回覧板、月に一度の溝掃除、夏祭りのテント張り、秋の防災訓練。',
    '面倒だと思う人も多い。けれど、回覧板を手渡しで回すことが、ひとり暮らしの高齢者の安否確認を兼ねている地域も少なくない。',
  ],
  choices: () => [
    {
      id: 'leader', label: '班長を引き受ける（回覧板・溝掃除・夏祭り・防災訓練）', detail: '健康+2 / 心+10 / 近所に見守ってくれる人ができる',
      tip: '溝掃除や草刈りのあとの立ち話で、近所の人の顔と暮らしぶりが自然にわかる。何かあったときに気づいてもらえる関係は、お金では買えない。',
      effect: { health: 2, heart: 10, flags: { community: true, social: true } },
      fragment: '六十九歳の一年間、私は自治会の班長をつとめた。日曜の朝の溝掃除では、泥の詰まった側溝の蓋を、向かいの家の主人と二人がかりで持ち上げた。回覧板を届けに行けば、どの家にも、それぞれの暮らしの匂いがある。年の瀬、隣の一人暮らしの老婦人が「あなたが回してくれると安心なのよ」と、蜜柑を三つ手のひらに載せてくれた。',
    },
    {
      id: 'minimum', label: '断って、回覧板だけは回す', detail: '変化なし',
      fragment: '六十九歳、班長の役は丁重に断った。回覧板だけは、読んだら判を押して、隣の家のポストにそっと差し込む。顔を合わせることは、ほとんどなかった。',
    },
    {
      id: 'leave', label: '付き合いが面倒なので、自治会を退会する', detail: '心+3（気楽） / 75歳以降、孤立しやすくなる',
      effect: { heart: 3, flags: { isolated: true } },
      fragment: '六十九歳、私は自治会を退会した。会費も、溝掃除も、夏祭りの手伝いもなくなった。気楽だった。ただ、ある朝、向かいの家に救急車が停まっていても、それが誰なのか、私にはもうわからなかった。',
    },
  ],
}

// 65歳：海外移住のきっかけ（声がかかるのは一部の人だけ）
EVENTS.e65_abroad = {
  chapter: 4, act: 3, imageId: 'img_abroad_65',
  when: (s, ctx, rand) => s.health >= 50 && s.flags.dog !== 'alive' && rand() < ABROAD_INVITE_RATE,
  title: '六十五歳、南の国からの絵はがき',
  body: () => [
    '大学時代の友人から、絵はがきが届いた。「チェンマイで暮らして三年になる。家賃も物価も安いし、冬がない。一度遊びに来ないか」。',
    'ロングステイ財団の調査では、ロングステイの希望国として長年マレーシアが1位、タイが2位だった。たとえばタイのリタイアメントビザは、50歳以上で、タイの銀行に80万バーツ（為替にもよるが350万円前後）を預けるか、月6万5千バーツ以上の収入を示す必要がある。ビザの条件は国ごとに違い、たびたび改定される。',
    '住民票を抜いて海外に転出すると、国民健康保険と介護保険の対象から外れる（年金は海外でも受け取れる）。現地では民間の医療保険が必要になる。',
  ],
  choices: () => [
    ...ABROAD_PLACES.map((pl) => ({
      id: pl.id, label: `${pl.name}に移住する`, minAssets: 350,
      lockReason: 'ビザの預金条件（350万円前後）を満たす資金がない',
      detail: '引っ越し費用-50万 / 生活費が日本の約7割に（目安） / 民間医療保険+25万/年 / 心+20 / 思い出+20',
      effect: { assets: -50, heart: 20, memory: 20, flags: { abroad: pl.name } },
      fragment: pl.fragment,
    })),
    {
      id: 'stayjp', label: 'ありがたいが、日本で暮らし続ける', detail: '変化なし',
      fragment: '六十五歳の冬、南の国から届いた絵はがきを、私は冷蔵庫に磁石で留めた。椰子の木の写真を眺めながら、こたつで蜜柑を剥く。行かなかった国の青い空は、それはそれで、私の台所を少しだけ明るくしてくれた。',
    },
  ],
}

// 75歳：海外からの帰国
EVENTS.e75_return = {
  chapter: 6, act: 5, imageId: 'img_abroad_65',
  when: (s) => livingAbroad(s),
  title: '七十五歳、帰国するか、ここに残るか',
  body: (s) => [
    `${s.flags.abroad}での暮らしも十年になった。けれど、介護が必要になったときのことを考えると、言葉の壁と医療費が気にかかる。`,
    '海外移住した高齢者が、介護や医療をきっかけに日本へ戻ることは珍しくない。帰国して住民票を戻せば、国民健康保険や介護保険にもまた入れる。',
  ],
  choices: (s) => [
    {
      id: 'return', label: '日本に帰国する', detail: '引っ越し費用-50万 / 心-5 / 生活費は日本の水準に戻る',
      effect: { assets: -50, heart: -5, flags: { returned: true } },
      fragment: `七十五歳の春、私は${s.flags.abroad}の部屋を引き払った。最後の朝、屋台のおばさんがいつもの麺に、黙って卵を一つ多く載せてくれた。成田に降り立つと、空気がひやりと乾いている。十年ぶりに区役所で住民票を戻し、保険証を受け取ったとき、私は自分がこの国の老人に戻ったのだと思った。`,
    },
    {
      id: 'remain', label: 'この国で最後まで暮らす', detail: '心+10 / 思い出+10 / 介護が必要になったときの不安は残る',
      effect: { heart: 10, memory: 10 },
      fragment: `七十五歳、私は${s.flags.abroad}に残ると決めた。言葉はいまだに片言だ。それでも市場の人たちは私の名前を覚え、雨季の午後には、軒先で一緒に雨宿りをしてくれる。ここで年をとっていくことの不安を、私は毎朝、熱い屋台の粥と一緒に飲み込んでいる。`,
    },
  ],
}

// 配偶者の介護（確率は要介護認定率、費用は生命保険文化センター 2024年度調査）
function spouseCareEvent(age, rate, imageId, chapter, act) {
  const ageK = age === 74 ? '七十四' : '七十九'
  const facilityTotal = Math.round(CARE_COST.oneTime + CARE_COST.facilityMonthly * CARE_COST.months)
  const years = Math.round((CARE_COST.months / 12) * 10) / 10
  return {
    chapter, act, imageId,
    when: (s, ctx, rand) => ctx.married && !s.flags.spouseCare && rand() < rate,
    title: `${ageK}歳、${age === 74 ? '健康寿命の向こう側で' : 'ふたたびの試練'}──配偶者の介護`,
    body: (s, ctx) => [
      `冬の朝、${spouse(ctx)}が台所で倒れた。命に別状はなかったが、要介護2と認定された。`,
      `介護の費用は、一時費用が平均${CARE_COST.oneTime}万円、月々は在宅で平均${CARE_COST.homeMonthly}万円、施設なら平均${CARE_COST.facilityMonthly}万円。介護の期間は平均${CARE_COST.months}か月（約${years}年）続く（生命保険文化センター 2024年度調査）。`,
    ],
    choices: (s, ctx) => [
      {
        id: 'homecare', label: '自宅で自分が介護する（老老介護）', requiresHealth: true,
        healthLockReason: '自分の足腰も弱っていて、ひとりで介護するのは難しい',
        detail: `一時費用-${CARE_COST.oneTime}万 / 在宅介護費 月${CARE_COST.homeMonthly}万×約${years}年 / 健康-15 / 心-10 / 思い出+8`,
        effect: { assets: -CARE_COST.oneTime, health: -15, heart: -10, memory: 8, tempCost: { perYear: CARE_COST.homeMonthly * 12, years }, flags: { spouseCare: 'home' } },
        fragment: `${ageK}歳の冬、${spouse(ctx)}が台所で倒れた。要介護二。私は、自分も七十を過ぎた身体で、${spouse(ctx)}の介護を始めた。朝は着替えを手伝い、昼は粥を炊き、夜は二時間おきに寝返りを打たせる。老老介護という言葉を、私はニュースの中だけのものだと思っていた。ある晩、${spouse(ctx)}がかすれた声で「ごめんね」と言った。私は返事のかわりに、その手を握った。骨ばった手は、それでも若い頃と同じ形をしていた。`,
      },
      {
        id: 'service', label: 'デイサービスや訪問介護を組み合わせて、在宅で支える',
        detail: `一時費用-${CARE_COST.oneTime}万 / 在宅介護費 月${CARE_COST.homeMonthly}万×約${years}年 / 健康-6 / 心-5 / 思い出+5`,
        effect: { assets: -CARE_COST.oneTime, health: -6, heart: -5, memory: 5, tempCost: { perYear: CARE_COST.homeMonthly * 12, years }, flags: { spouseCare: 'service' } },
        fragment: `${ageK}歳の冬から、${spouse(ctx)}は週に三日、デイサービスに通うようになった。朝九時、送迎の車が家の前に停まる。スタッフさんが「お預かりしますね」と笑い、${spouse(ctx)}は窓の向こうから小さく手を挙げた。その数時間が、私が息をつける時間だった。ケアマネジャーという人がいなければ、私たちはきっと、二人とも倒れていた。`,
      },
      {
        id: 'facility', label: '介護付きの施設に入ってもらう', minAssets: facilityTotal,
        lockReason: `施設の費用（月${CARE_COST.facilityMonthly}万円×平均${CARE_COST.months}か月＋一時費用）の約${facilityTotal}万円が用意できず、施設には入れない`,
        detail: `一時費用-${CARE_COST.oneTime}万 / 施設費 月${CARE_COST.facilityMonthly}万×約${years}年 / 心-5`,
        effect: { assets: -CARE_COST.oneTime, heart: -5, tempCost: { perYear: CARE_COST.facilityMonthly * 12, years }, flags: { spouseCare: 'facility' } },
        fragment: `${ageK}歳の冬、${spouse(ctx)}は介護付きの施設に入った。月々の請求書が届くたび、通帳の数字は目に見えて減っていく。週に二度、私はバスを乗り継いで面会に通った。帰り際、${spouse(ctx)}が窓辺で小さく手を振る。その姿がガラスに映る夕焼けに溶けていくのを、私は毎回、見えなくなるまで見ていた。`,
      },
    ],
  }
}

// 80代の日々（デイサービス／地域のサロン）。暗い話で終わらせず、楽しい日常を描く
EVENTS.e83_days = {
  chapter: 7, act: 5, imageId: 'img_days_83',
  title: '八十三歳、楽しみのある一週間',
  body: (s) => (s.flags.mobilityLimited || s.health < 45
    ? ['足腰が弱り、ケアマネジャーから、週に二回のデイサービスをすすめられた。送迎つきで、昼食とお風呂、レクリエーションがある。', '要介護1で1割負担なら、週2回通っても自己負担は月1万円前後（食費は別）が目安だ。']
    : ['八十三歳。足はまだ自分のものだ。公民館では、老人クラブのサロンが毎週ひらかれている。', 'お茶とおしゃべり、ときどき体操と、季節の小旅行。参加費は一回数百円ほど。'])
  ,
  choices: (s) => (s.flags.mobilityLimited || s.health < 45
    ? [
      {
        id: 'dayservice', label: '週二回、デイサービスに通う', detail: '資産-12万/年 / 心+15 / 思い出+8',
        effect: { heart: 15, memory: 8, tempCost: { perYear: 12, years: 3 } },
        fragment: '八十三歳の私の楽しみは、火曜と金曜のデイサービスだ。朝、送迎の車が来ると、近所の誰かが窓から手を振る。大きなお風呂で手足を伸ばし、昼は季節の献立。午後のカラオケ大会で、私は「青い山脈」を歌って、九十点を出した。拍手をくれたのは、昨日会ったばかりの、八十九歳の元大工だった。',
      },
      {
        id: 'stayhome', label: '人に会うのが億劫で、家で過ごす', detail: '心-5',
        effect: { heart: -5 },
        fragment: '八十三歳、デイサービスの案内は、テーブルの上で少しずつ黄ばんでいった。家にいれば誰にも気を遣わずに済む。けれど夕方、時計の秒針の音ばかりが大きく聞こえる日が、少しずつ増えていった。',
      },
    ]
    : [
      {
        id: 'salon', label: '老人クラブのサロンに通い、季節の日帰り旅行にも参加する', detail: '資産-5万 / 心+15 / 思い出+10',
        effect: { assets: -5, heart: 15, memory: 10 },
        fragment: '八十三歳の私は、毎週水曜、公民館のサロンに通っている。お茶を淹れるのは、いちばん若い七十六歳の係だ。春には貸切バスで藤の花を見に行った。帰りの車内でマイクが回ってきて、私は照れながら一曲歌った。窓の外を流れる田植え前の水田が、夕日を映して金色に光っていた。',
      },
      {
        id: 'own', label: 'これまでの趣味を、自分のペースで続ける', detail: '心+10 / 思い出+6',
        effect: { heart: 10, memory: 6 },
        fragment: (st) => `八十三歳。${st.hobbies?.length ? `${st.hobbies.join('、')}——` : ''}長く続けてきた楽しみが、私の一週間にちゃんと目盛りを刻んでくれる。「今日は何の日だったかな」とカレンダーを見るのが、毎朝の小さな楽しみになった。`,
      },
    ])
  ,
}

const ABROAD_PLACES = [
  {
    id: 'thai', name: 'タイ・チェンマイ',
    fragment: '六十五歳の冬、私はタイのチェンマイに移り住んだ。旧市街の堀の水面に、托鉢の僧侶のオレンジ色が揺れている。市場で買うマンゴーは一個数十円。言葉は通じないが、笑えば笑い返してくれる。日本の冬を一度も過ごさない一年が、こんなにも身体を軽くするとは思わなかった。',
  },
  {
    id: 'malaysia', name: 'マレーシア・クアラルンプール',
    fragment: '六十五歳の冬、私はマレーシアのクアラルンプールに移り住んだ。コンドミニアムのプールで朝のひと泳ぎをし、屋台のロティ・チャナイを頬張る。モスクの祈りの声と、中華街の線香の匂いと、インド料理の香辛料が、同じ通りに混ざり合っている。この街では、誰もが少しずつよそ者だった。',
  },
  {
    id: 'philippines', name: 'フィリピン・セブ',
    fragment: '六十五歳の冬、私はフィリピンのセブ島に移り住んだ。英語の通じる島で、近所の子どもたちに日本語を教えるボランティアを始めた。夕方になると、海から湿った風が吹いてきて、どこかの家のカラオケが、少し調子外れの歌を夜空に放り上げる。',
  },
]

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
