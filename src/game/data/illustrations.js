// イラストスロット（16:9）の定義（SPEC.md 第7章）
// public/assets/images/${id}.jpg を置くと自動で表示され、未配置ならグラデーション＋シルエットで描画する。
// sky: 背景グラデーション（上→下）、icon: シルエットの種類

export const ILLUSTRATIONS = {
  img_start_50: { caption: '夕暮れの交差点', sub: '五十歳、秋', sky: ['#f6c48b', '#e0866a', '#5d4a6e'], icon: 'city' },
  img_care_55: { caption: '実家の長い廊下', sub: '五十五歳、冬', sky: ['#d9cbb3', '#9c8a73', '#3e3530'], icon: 'window' },
  img_countdown_57: { caption: 'カウントダウン', sub: '五十七歳、夏', sky: ['#bfe3f0', '#f1d9a6', '#c47a4f'], icon: 'car' },
  img_dog_58: { caption: '保護犬の譲渡会', sub: '五十八歳、秋の公園', sky: ['#f3e2c4', '#d9b48a', '#7a5d48'], icon: 'dog' },
  img_pension_60: { caption: '四つの数字の窓口', sub: '六十歳、春', sky: ['#f5dfe4', '#e7b8c2', '#8c6b7f'], icon: 'counter' },
  img_nisa_60: { caption: '退職金と、新NISAの口座', sub: '六十歳、春', sky: ['#e6eef0', '#bcd3d6', '#567a82'], icon: 'graph' },
  img_hobby_61: { caption: '平日の時間割に、趣味を一行', sub: '六十一歳、春', sky: ['#e3f0dc', '#c6dcb4', '#6f8f62'], icon: 'easel' },
  img_illness_63: { caption: '病院の相談室', sub: '六十三歳、冬', sky: ['#e4e8ea', '#b9c2c7', '#5f6b72'], icon: 'counter' },
  img_romance_64: { caption: '思いがけない出会い', sub: '六十四歳、秋', sky: ['#f7dcc4', '#e8a98a', '#8a5a62'], icon: 'bench' },
  img_work_60_office: { caption: '同じデスク、違う肩書き', sub: '六十歳、春の夕方', sky: ['#dfe7ea', '#a8b8c0', '#4b5a66'], icon: 'desk' },
  img_work_60_free: { caption: '平日の午前十時', sub: '六十歳、春', sky: ['#cfe8f3', '#f4ecd2', '#9fc39a'], icon: 'bench' },
  img_reunion_62: { caption: '六十二歳の同窓会', sub: '居酒屋「ほたる」、十一月の夜', sky: ['#3a2f45', '#7a4b3d', '#e2a35b'], icon: 'izakaya' },
  img_bankbook: { caption: '偶数月十五日の通帳', sub: '六十五歳', sky: ['#eef1f3', '#c9d3d8', '#7b8d96'], icon: 'bankbook' },
  img_travel_67: { caption: '動けるうちの、最後の遠出', sub: '六十七歳、秋の海', sky: ['#f9d29d', '#ef8c6a', '#33556e'], icon: 'sea' },
  img_hobby_66: { caption: '誰かと一緒にやる趣味', sub: '六十六歳', sky: ['#f6e7d0', '#e9c49a', '#9b6b4f'], icon: 'easel' },
  img_work_65_senior: { caption: '冬の早朝ワーク', sub: '六十七歳、朝六時', sky: ['#1f2d45', '#5b6e8c', '#c9d6e3'], icon: 'broom' },
  img_crash_68: { caption: '世界同時株安', sub: '六十八歳、冬', sky: ['#2b2f3a', '#5a4650', '#a4545a'], icon: 'crash' },
  img_dog_71: { caption: 'こむぎの介護', sub: '七十一歳、冬の居間', sky: ['#efe4d6', '#cdb9a3', '#6e5a4c'], icon: 'dog' },
  img_health_wall_72: { caption: '七十二歳の朝', sub: '冬、目覚まし時計の前', sky: ['#e8eef3', '#b7c4cf', '#6f7f8c'], icon: 'futon' },
  img_reunion_73: { caption: '七十三歳の同窓会', sub: '雨の午後の和食店', sky: ['#7f8f8a', '#a9b6ad', '#4f5d58'], icon: 'washoku' },
  img_care_74: { caption: '配偶者の介護', sub: '健康寿命の向こう側で', sky: ['#e6e1ea', '#bfb4c6', '#5f5466'], icon: 'window' },
  img_hobby_74: { caption: '頭と指先を使う趣味', sub: '七十四歳', sky: ['#e8eedf', '#c4d1ae', '#6f7d55'], icon: 'easel' },
  img_late_75_home: { caption: '後期高齢者の現実', sub: '七十五歳、梅雨', sky: ['#9fb0a6', '#c8c3a8', '#6b6a5a'], icon: 'house' },
  img_license_77: { caption: '免許証を返す日', sub: '七十七歳、春', sky: ['#cde6d9', '#e9e1c3', '#8a9a7b'], icon: 'busstop' },
  img_stage_79: { caption: 'ささやかな晴れ舞台', sub: '七十九歳', sky: ['#fbe7c6', '#f2b97c', '#a25b4b'], icon: 'stage' },
  img_days_83: { caption: '楽しみのある一週間', sub: '八十三歳', sky: ['#fdf0d8', '#f4cf9b', '#b07a55'], icon: 'stage' },
  img_final_85: { caption: '損益分岐点の向こう側', sub: '八十二歳〜八十五歳', sky: ['#f7e3c2', '#e3a77a', '#7d5d6d'], icon: 'windowsill' },
  img_reunion_82: { caption: '最後の同窓会', sub: 'ホテルのティーラウンジ、四月の昼下がり', sky: ['#f6efe0', '#e8d6b4', '#b48e6a'], icon: 'teacup' },
}

export const ILLUSTRATION_IDS = Object.keys(ILLUSTRATIONS)
