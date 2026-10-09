#!/usr/bin/env python3
"""/politech/（政治・政策キーワード）196枚の本文を作り直す（2026-10-09）。

以前の本文（data/politech-copy.json・gemma4）は「答え」の中に当社の宣伝が混ざり、
題名は「〜｜政党・議員事務所が動くページで答える」。「守山区 保育園 空き状況」で5〜9位に出ても
クリック0だった。検索した人が知りたいことに答える本文を data/politech-content/<slug>.json に作り、
build-politech.ts はこちらを優先する（無ければ従来の copy を使う）。

  /usr/bin/python3 scripts/gen_politech_content.py [--only shougaku-kin] [--force] [--jobs 4]
"""
import argparse, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_gen import RULES, ask, common_check, run_batch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'politech-content'
KWS = json.load(open(ROOT / 'data' / 'politech-keywords.json', encoding='utf-8'))
BY = {k['slug']: k for k in KWS}
INTENT = {'place': '場所・一覧を知りたい', 'howto': 'やり方・手続きを知りたい', 'benefit': '制度・給付を知りたい',
          'define': '意味・対策を知りたい', 'topic': '全体像を知りたい'}

SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。検索語をそのまま先頭に置き、「｜」で区切って何が分かるかを続ける",
 "h1": "ページの大見出し。30字前後",
 "lead": "冒頭の段落 2〜3文。検索した人の状況に寄り添って、このページで分かることを言う",
 "points": ["この検索語で探している人が知りたいこと3つ（短い名詞句）"],
 "answer": ["答えの段落。3〜5段落、各150〜280字。制度の仕組み・対象・窓口・調べ方・よくあるつまずきを、検索した人に向けて具体的に"],
 "sections": [{"h": "見出し", "p": "本文 150〜280字"}],
 "steps": [{"t": "政党・議員事務所が、この課題で住民の相談に応えるためにできること（見出し）", "b": "本文 80〜150字"}],
 "faq": [{"q": "検索した人が実際に持つ疑問", "a": "答え 100〜200字"}]
}
points は3つ、answer は3〜5段落、sections は2〜3個（answer で書ききれない具体：必要書類・期限の考え方・地域による違い・関連する制度など）、steps は3つ、faq は3つ。"""


def prompt(slug):
    k = BY[slug]
    nagoya = '名古屋' in k['theme_name'] or k['theme'] == 'nagoya'
    return f"""あなたは行政の制度と地域の暮らしに詳しい編集者です。次の検索語で検索した人に向けて、ページの本文を書いてください。

検索語: {k['keyword']}（月におよそ{k['volume']:,}回検索される）
テーマ: {k['theme_name']}
検索した人の目的: {INTENT.get(k['intent'], '')}
{'このページは名古屋市の住民向け。名古屋市の制度・窓口（区役所・支所など）に即して書く。' if nagoya else '全国の住民向け。国の制度を軸に、自治体ごとに違う点は「お住まいの市区町村で」と書く。'}

このページの役割: 前半（answer と sections）は、検索した人の疑問に正面から答える。当社やその商品の宣伝は一切書かない。
後半（steps）だけは、政党・議員事務所の担当者に向けて、この課題で住民の相談にどう応えられるかを書く（当社の商品名は出さない）。

制度の名前・根拠となる法律・国の窓口（省庁・独立行政法人など）は、確かなものだけを正式な名前で書く。
所管の官庁は今のもので書く（子ども・子育て・保育・児童手当などは2023年4月からこども家庭庁。内閣府・厚生労働省と書かない）。
金額・所得の基準・期限・対象年齢などの数字は、毎年変わるものや確かでないものは書かず、「最新の金額は〇〇で確認してください」と確認先を示す。
「空き状況」「場所」のように、その時々で変わる情報を探している人には、どこを見れば最新が分かるか（公式の一覧・問い合わせ先・調べ方）を具体的に書く。このページ自体に最新の情報があるかのように書かない。
特定の政党・候補者を支持・批判しない。

{RULES}

出力の形:
{SCHEMA}"""


def check(d):
    err = common_check(d, ['title', 'h1', 'lead', 'points', 'answer', 'sections', 'steps', 'faq'])
    if err:
        return err
    if len(d['answer']) < 3 or len(d['steps']) < 3 or len(d['faq']) < 3:
        return '数が足りない'
    front = json.dumps([d['lead'], d['answer'], d['sections'], d['faq']], ensure_ascii=False)
    if re.search(r'Kurage|エクスブリッジ|当社|弊社|AI-IT顧問|顧問契約', front):
        return '前半に当社の宣伝が入っている'
    return ''


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*'); ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--force', action='store_true'); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    ng = run_batch(a.only or list(BY), lambda k: OUT / f'{k}.json', lambda k: ask(prompt(k), check),
                   jobs=a.jobs, force=a.force, limit=a.limit)
    sys.exit(1 if ng else 0)
