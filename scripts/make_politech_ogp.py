#!/usr/bin/env python3
"""politech テーマ別 OGP 1200×630（ライト・中央寄せ・マスコット）。 /usr/bin/python3 scripts/make_politech_ogp.py"""
import os
from PIL import Image, ImageDraw, ImageFont
W,H=1200,630; OUT="/home/kojima/work/exbridge_jp/images/ogp"; MASCOT="/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png"
FB="/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"; FM="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"; FR="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
THEMES={"bousai":"防災・災害","kosodate":"子育て・少子化","shussan":"出産・子育て給付","kyoiku":"教育・奨学金","futoko":"不登校・学びの支援","fukushi":"福祉・高齢・障害・ひとり親","seikatsu":"給付金・生活・住まい","senkyo":"選挙・政治参加","chiiki":"地域・防犯・移住","nagoya":"名古屋市のくらし"}
m=Image.open(MASCOT).convert("RGBA"); m=m.resize((int(m.width*280/m.height),280))
f=lambda p,s: ImageFont.truetype(p,s)
for key,name in THEMES.items():
    img=Image.new("RGB",(W,H),"#ffffff"); dr=ImageDraw.Draw(img,"RGBA")
    dr.ellipse([-180,-240,480,380],fill=(230,244,242,255)); dr.ellipse([W-460,H-330,W+220,H+240],fill=(240,246,246,255))
    cx=520
    badge=f"政治・政策キーワード ・ {name}"; bw=dr.textlength(badge,font=f(FM,26))+40
    dr.rounded_rectangle([cx-bw/2,96,cx+bw/2,144],radius=24,fill="#e6f4f2",outline="#bfe3de"); dr.text((cx,120),badge,font=f(FM,26),fill="#0a726b",anchor="mm")
    dr.text((cx,222),"住民が検索している言葉に、",font=f(FB,58),fill="#12202f",anchor="mm")
    dr.text((cx,300),"「動くページ」で答える。",font=f(FB,52),fill="#0a9a8f",anchor="mm")
    dr.text((cx,372),"政党・議員事務所のための買い切りの道具と、",font=f(FR,27),fill="#5d6b7a",anchor="mm")
    dr.text((cx,412),"政党・政治団体にも提供する AI-IT顧問契約。",font=f(FR,27),fill="#5d6b7a",anchor="mm")
    dr.rounded_rectangle([cx-230,470,cx+230,530],radius=16,fill="#0a9a8f"); dr.text((cx,500),"株式会社エクスブリッジ",font=f(FM,30),fill="#ffffff",anchor="mm")
    img.paste(m,(W-m.width-40,H-m.height-30),m); dr.text((40,H-40),"exbridge.jp/politech/",font=f(FR,22),fill="#5d6b7a",anchor="lm")
    img.save(os.path.join(OUT,f"politech-{key}.png"),optimize=True)
print("OGP 10枚 生成")
