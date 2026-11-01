# どうぐモンスター（教室タイマーソング用キャラクター）

教室の道具が「付喪神（つくもがみ）」のようにモンスターになった、オリジナルキャラクター。
Canva の画像生成で作成（作家名・作品名・既存キャラクター名は指示に使っていない）。
画像は Canva アカウントに保存されている。下のリンクから開いて PNG でダウンロードできる。

## 12 体

| 道具 | 種族 | 目 | Canva |
| --- | --- | --- | --- |
| けしゴム | ゴーレム（ずんぐり） | 外側が緑・内側が黄色の二重の輪 | [MAHZovKUWcs](https://www.canva.com/M/MAHZovKUWcs) |
| ハブラシ | 野獣（ひょろ長） | ミント／ターコイズの二重の輪の一つ目 | [MAHZojSnh00](https://www.canva.com/M/MAHZojSnh00) |
| えんぴつ | ドラゴン（飛ぶ） | 黄色の瞳に縦長の瞳孔 | [MAHZopuEUS8](https://www.canva.com/M/MAHZopuEUS8) |
| 上ばき | 大ガエル（低く跳ねる） | 金色の瞳・眠そうなまぶた | [MAHZonX-TK8](https://www.canva.com/M/MAHZonX-TK8) |
| ほうき | 魔女（背が高い） | 帽子の影で光る黄色い目 | [MAHZotCfzRA](https://www.canva.com/M/MAHZotCfzRA) |
| ノート | 魔導書のおばけ（浮く） | 紫の瞳に星形の瞳孔の一つ目 | [MAHZot13WEs](https://www.canva.com/M/MAHZot13WEs) |
| はさみ | カニ | 飛び出した赤い目 | [MAHZonb4Nz0](https://www.canva.com/M/MAHZonb4Nz0) |
| のり | ドロドロ（横に広がる） | 黄色い瞳の目がたくさん | [MAHZopXTvt0](https://www.canva.com/M/MAHZopXTvt0) |
| ぞうきん | おばけ | 目なし（暗い穴だけ） | [MAHZog9l2XI](https://www.canva.com/M/MAHZog9l2XI) |
| ランドセル | 宝箱おばけ | 暗い中で赤く光る目 | [MAHZomCT8PI](https://www.canva.com/M/MAHZomCT8PI) |
| リコーダー | ヘビ | 緑と紫のうずまき目 | [MAHZop5IeNw](https://www.canva.com/M/MAHZop5IeNw) |
| おたま | 騎士（給食エプロン） | 青い二重の輪 | [MAHZohQ83ss](https://www.canva.com/M/MAHZohQ83ss) |

低学年向けに気になる点: ランドセル（暗い口の中の赤い目）とぞうきん（穴の目とニタッとした口）は少し不気味。

## 絵柄をそろえる指示（新しく作るときに使う）

共通の絵柄:

```
Classic Japanese RPG monster bestiary art: bold clean black ink outlines, bright flat cel-shaded colors
with simple shading, chunky playful proportions, funny rather than scary.
Single character centered on a plain flat white background, no text, no other characters.
```

目（基本形。モンスターごとに色や形を変える）:

```
detailed classic Japanese RPG monster eyes: white eyeballs with a thick black ink outline,
a colored iris made of two concentric rings (outer ring ___, inner ring ___),
a black pupil in the center and one small white highlight dot
```

方針:

- 「道具＋手足」だけでなく、ドラゴン・魔女・ゴーレム・おばけ・騎士など、ファンタジーの定番の種族と組み合わせる
- 種族・体型（シルエット）・目・ポーズを 1 体ずつ変える。目のないモンスターも混ぜる
- 既存のゲームのモンスター（スライムなど）に似せない。指示に作品名・作者名を入れない
- 切り絵アニメにしやすいよう、全身・手足が体から離れたポーズ・無地の背景にする

## 次の段階

1. **2D 切り絵アニメ（おすすめ）**: Canva から PNG をダウンロード → 背景を切り抜く → `lyric/scene.js` の仕組みで、拍に合わせて行進・ジャンプ・登場させる
2. **3D（試すなら 1〜2 体）**: Blender + mcp-for-blender の画像→3D 連携（Meshy / Tripo / Hyper3D Rodin / Hunyuan3D）。けしゴム・ランドセルなど、かたまりの形が向いている。Meshy の無料プランは CC BY 4.0（クレジット表記で商用可）、Tripo の無料プランは商用不可とされる（公開前に最新の規約を確認）
3. **2.5D**: Blender の 3D 空間に 2D の切り絵を板として並べ、カメラを動かす
