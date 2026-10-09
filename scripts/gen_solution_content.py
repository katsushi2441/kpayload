#!/usr/bin/env python3
"""/solution/ の業種×業務ページと業種トップに、ページごとの本文を作る（2026-10-09）。

それまでの業種×業務ページ（527枚）は、業種の説明1段落だけを差し替えた同じ文章で、
2枚を比べると89%が同じ行だった。Google に量産ページと見なされ、90日で10クリックしかない。
そこで、1枚ずつ「その業種のその業務」の本文を claude -p で作り、
data/solution-content/<業種>/<業務>.json（業種トップは _hub.json）に保存する。
build-solution.ts はこの JSON があればそれを流し込む。

  /usr/bin/python3 scripts/gen_solution_content.py               # 未作成のものを全部
  /usr/bin/python3 scripts/gen_solution_content.py --only kaigo/kintai hoiku/_hub
  /usr/bin/python3 scripts/gen_solution_content.py --jobs 4 --limit 10

既にある JSON は作り直さない（--force で作り直す）。OSS の表は dist/solution の
今のページから読むので、先に build-solution.ts を1回走らせておくこと。
"""
import argparse, concurrent.futures as cf, html, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'solution-content'
DIST = ROOT / 'dist' / 'solution'
M = json.load(open(ROOT / 'data' / 'solution-matrix.json', encoding='utf-8'))
G = {g['slug']: g for g in M['gyomu']}
I = {i['slug']: i for i in M['industries']}

RULES = """\
守ること（破ったら書き直し）:
- 書くのは「その業種の、その業務」に固有のことだけ。業種名を入れ替えれば他の業種にも通じる一般論は書かない。
- 制度・法律・業界の決まりは、確かなものだけを正式な名前で書く。条文番号・施行日・金額・割合・件数などの数字は、確実なものだけ。迷ったら数字を書かない。
- 統計・市場規模・「〇割の事業者が」のような数字は書かない。
- 当社（株式会社エクスブリッジ）の導入実績・お客様の声・事例は書かない（存在しない）。「よく伺う」「多い」程度にとどめる。
- 特定の他社製品をけなさない。業界の専用ソフトは「業界の専用ソフト」と書いてよく、代表的な製品名を挙げるのは構わない。
- 当社が売り込む文は書かない（相談ボタンや価格はテンプレート側にある）。読者は、その業種の事務・経営者。
- 文体は「です・ます」。短い断定を並べない。人が説明するときの長さで書く。見出しは体言止めか、短い文。
- 出力は JSON だけ。前後に説明文やコードブロックの記号を付けない。"""

PAIR_SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。検索する人が打つ言葉（例: 「保育園 勤怠管理」「倉庫 作業手順書」）を先頭に置き、「｜」で区切って何が分かるページかを続ける（形は「保育園 勤怠管理｜シフトと延長保育の記録」）。「安くする」「OSSと内製化」は使わない",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落。この業種でこの業務がなぜ手間になるのかを、現場の具体（使う書類・時期・人の動き）で2〜3文",
 "points": [{"h": "見出し", "p": "本文 120〜220字"}],
 "features": ["この業種でこの業務のシステムに要る機能を、具体的に1行ずつ"],
 "split": [
   {"h": "業界の専用ソフト・既存サービスに任せたほうがよい部分", "p": "本文"},
   {"h": "オープンソースや買い切りのシステムで持てる部分", "p": "本文"},
   {"h": "紙・Excelのままでよい部分", "p": "本文"}
 ],
 "steps": ["導入の進め方を1手順ずつ。この業種の事情（繁忙期・資格者・現場と事務所など）を織り込む"],
 "faqs": [{"q": "この業種の人が実際に持つ疑問", "a": "答え 100〜200字"}]
}
points は4つ、features は6〜8個、steps は4〜5個、faqs は3つ。"""

HUB_SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。「<業種> システム」「<業種> 業務効率化」など検索する人の言葉を先頭に置き、「｜」で区切って続ける（形は「介護事業所のシステム｜記録・シフト・請求の外側を整える」）",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落 2〜3文。この業種の事務の全体像",
 "sections": [{"h": "見出し", "p": "本文 150〜250字"}],
 "faqs": [{"q": "疑問", "a": "答え 100〜200字"}]
}
sections は4つ（この業種の事務で時間を取られている所／業界の専用ソフトが担う所と、その外側に残る事務／制度・決まりで気をつける所／どの業務から手を付けるとよいか）、faqs は3つ。"""


def oss_rows(ind, g):
    """今のページの OSS 表から「名前: できること」を読む。"""
    p = DIST / ind / f'{g}.html'
    if not p.exists():
        return []
    s = p.read_text(encoding='utf-8')
    rows = re.findall(r'<tr><th><a [^>]*>(.*?)</a></th><td>(.*?)</td><td>(.*?)</td>', s)
    return [f'{html.unescape(n)}（{html.unescape(l)}）: {html.unescape(d)}' for n, d, l in rows]


def pair_prompt(ind, g):
    i, x = I[ind], G[g]
    others = [G[k]['name'] for k in G if k not in i['skip']]
    oss = oss_rows(ind, g)
    prods = [f"{p['name']}（{p['price']}）" for p in x['products']]
    return f"""あなたは中小企業の業務システムに詳しい編集者です。次のページの本文を書いてください。

ページ: 「{i['name']}（{i['kicker']}）」の「{x['name']}」
この業務でよくある悩み: {x['pain']}
この業種について当社がまとめたメモ: {i['context']}
同じ業種で別ページがある業務（ここでは触れすぎない）: {'、'.join(o for o in others if o != x['name'])}
ページの下に表で載せるオープンソース: {' / '.join(oss) or 'なし'}
ページの下に載せる当社の買い切りシステム: {' / '.join(prods) or 'なし'}

{RULES}

出力の形:
{PAIR_SCHEMA}"""


def hub_prompt(ind):
    i = I[ind]
    gy = [G[k]['name'] for k in G if k not in i['skip']]
    return f"""あなたは中小企業の業務システムに詳しい編集者です。次のページの本文を書いてください。

ページ: 「{i['name']}（{i['kicker']}）」の事務・ITの全体像。下に業務別のページ（{'、'.join(gy)}）へのリンクが並ぶ。
この業種について当社がまとめたメモ: {i['context']}

{RULES}

出力の形:
{HUB_SCHEMA}"""


def check(d, hub):
    need = ['title', 'description', 'lead', 'faqs'] + (['sections'] if hub else ['points', 'features', 'split', 'steps'])
    miss = [k for k in need if not d.get(k)]
    if miss:
        return f'欠け: {miss}'
    if '｜' not in d['title']:
        return '題名に「｜」が無い'
    if len(d['title']) > 34:
        return f'題名が長い({len(d["title"])}字)'
    if re.search(r'当社の(導入)?(事例|実績)|お客様の声|導入事例', json.dumps(d, ensure_ascii=False)):
        return '実績・事例を書いている'
    if not hub and (len(d['points']) < 3 or len(d['faqs']) < 3):
        return '数が足りない'
    return ''


def run(key, model, force):
    ind, g = key.split('/')
    hub = g == '_hub'
    out = OUT / ind / f'{g}.json'
    if out.exists() and not force:
        return key, 'skip'
    prompt = hub_prompt(ind) if hub else pair_prompt(ind, g)
    last = ''
    for attempt in range(3):
        try:
            r = subprocess.run(['claude', '-p', '--model', model, '--tools', '', '--no-session-persistence',
                                '--output-format', 'text'], input=prompt + (f'\n\n前回の出力は不合格でした（{last}）。直して出力してください。' if last else ''),
                               capture_output=True, text=True, timeout=600, cwd='/tmp')
        except subprocess.TimeoutExpired:
            last = 'タイムアウト'; continue
        t = r.stdout.strip()
        t = re.sub(r'^```(?:json)?\s*|\s*```$', '', t)
        try:
            d = json.loads(t[t.index('{'):t.rindex('}') + 1])
        except Exception:
            last = f'JSONとして読めない: {t[:120]!r} {r.stderr[:200]}'
            if 'limit' in (t + r.stderr).lower():
                return key, f'NG 利用上限: {t[:200]}'
            continue
        err = check(d, hub)
        if err:
            last = err; continue
        d['_generated'] = time.strftime('%Y-%m-%d')
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        return key, 'ok'
    return key, f'NG {last}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--model', default='sonnet')
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    keys = a.only or ([f'{i}/_hub' for i in I] + [f'{i}/{g}' for i in I for g in G if g not in I[i]['skip']])
    if not a.force:
        keys = [k for k in keys if not (OUT / f'{k}.json').exists()]
    if a.limit:
        keys = keys[:a.limit]
    print(f'{len(keys)}件を作ります', flush=True)
    ng = 0
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for n, (k, st) in enumerate(ex.map(lambda k: run(k, a.model, a.force), keys), 1):
            print(f'[{n}/{len(keys)}] {k} {st}', flush=True)
            if st.startswith('NG'):
                ng += 1
                if '利用上限' in st:
                    print('利用上限に当たったので止めます', flush=True); os._exit(2)
    print(f'終わり: NG {ng}件', flush=True)
    sys.exit(1 if ng else 0)


if __name__ == '__main__':
    main()
