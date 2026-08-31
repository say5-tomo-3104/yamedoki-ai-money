# -*- coding: utf-8 -*-
"""「一粒の米自主学習用ノート」1枚バージョン生成スクリプト

元の A3（1枚に2〜4面付け）テンプレートPDFから1面だけを取り出し、
上部に「一粒の米自主学習用ノート」の見出しを付けた A4 1枚版を作る。
"""
import pathlib
import pymupdf

SRC = pathlib.Path("/root/.claude/uploads/f4856bb2-57ce-5f80-a5ee-3ad1818e93b9")
OUT = pathlib.Path(__file__).resolve().parent
FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf"

TITLE = "一粒の米自主学習用ノート"
A4_W, A4_H = 595.276, 841.890
MARGIN = 28.0
TITLE_SIZE = 17.0
HEAD_H = 52.0          # 見出し帯の高さ（余白上端からの距離）
RULE_COLOR = (0.45, 0.45, 0.45)

# name, source file, page, 切り出す1面の矩形, 出力の向き, 原寸維持(=拡大縮小しない)
SHEETS = [
    ("01_kiroku",   "66c07045-9914_kiroku.pdf",      (70.9,  28.3,  583.9, 409.6), "landscape", False),
    ("02_nikki",    "9bd22817-9914_nikki.pdf",       (70.9,  28.3,  581.1, 406.8), "landscape", False),
    ("03_planner",  "52b727c8-9914_studyplanner.pdf",(70.8,  25.9,  581.4, 794.6), "portrait",  False),
    ("04_hougan",   "45aecadf-9914_hougan_1.pdf",    None,                          "portrait",  True),
    ("05_dot",      "ddcd94f0-9914_dottohougan.pdf", None,                          "portrait",  True),
]


def build(name, src_name, clip, orient, keep_scale):
    src = pymupdf.open(SRC / src_name)
    pw, ph = (A4_H, A4_W) if orient == "landscape" else (A4_W, A4_H)

    doc = pymupdf.open()
    page = doc.new_page(width=pw, height=ph)

    # --- 見出し ---
    tw = pymupdf.Font(fontfile=FONT).text_length(TITLE, fontsize=TITLE_SIZE)
    page.insert_text(
        (pw / 2 - tw / 2, MARGIN + TITLE_SIZE),
        TITLE, fontname="ipagp", fontfile=FONT, fontsize=TITLE_SIZE,
        render_mode=2, border_width=0.035,          # 疑似ボールド
    )
    rule_y = MARGIN + HEAD_H - 14
    page.draw_line((MARGIN, rule_y), (pw - MARGIN, rule_y), color=RULE_COLOR, width=0.7)

    # --- 中身を配置する領域 ---
    box = pymupdf.Rect(MARGIN, MARGIN + HEAD_H, pw - MARGIN, ph - MARGIN)

    if keep_scale:
        # 方眼・ドット方眼はマス目の大きさを変えたくないので原寸のまま切り出す
        sp = src[0].rect
        cx0 = (sp.width - box.width) / 2
        cy0 = (sp.height - box.height) / 2
        clip_rect = pymupdf.Rect(cx0, cy0, cx0 + box.width, cy0 + box.height)
        target = box
    else:
        clip_rect = pymupdf.Rect(*clip)
        ratio = clip_rect.width / clip_rect.height
        w, h = box.width, box.width / ratio
        if h > box.height:
            h, w = box.height, box.height * ratio
        cx, cy = (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2
        target = pymupdf.Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)

    page.show_pdf_page(target, src, 0, clip=clip_rect)

    path = OUT / f"ichiryuu-kome_{name}_A4.pdf"
    doc.save(path, garbage=4, deflate=True)
    print(f"{path.name}: {pw:.0f}x{ph:.0f}pt  content={target.width:.0f}x{target.height:.0f}")


for args in SHEETS:
    build(*args)
