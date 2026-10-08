"""量産ページの本文を claude -p で1枚ずつ作る共通部品（2026-10-09）。

gen_solution_content.py で作ったやり方を、helpdesk / outsourcing / saas / politech / zenn に
使い回すためのもの。各 gen_*_content.py は、ページごとのプロンプトと検査関数を渡すだけにする。
"""
import concurrent.futures as cf, json, os, re, subprocess, time
from pathlib import Path

RULES = """\
守ること（破ったら書き直し）:
- 書くのは、このページの主題に固有のことだけ。主題の言葉を入れ替えれば他のページにも通じる一般論は書かない。
- 制度・法律・業界の決まりは、確かなものだけを正式な名前で書く。条文番号・施行日・金額・割合・件数などの数字は、確実なものだけ。迷ったら数字を書かない。
- 統計・市場規模・「〇割の企業が」のような数字は書かない。
- 当社（株式会社エクスブリッジ）の導入実績・お客様の声・事例は書かない（存在しない）。
- 特定の他社をけなさない。
- 当社が売り込む文は書かない（相談ボタンや当社の案内はテンプレート側にある）。
- 文体は「です・ます」。短い断定を並べない。人が説明するときの長さで書く。
- 出力は JSON だけ。前後に説明文やコードブロックの記号を付けない。"""


def common_check(d, need):
    miss = [k for k in need if not d.get(k)]
    if miss:
        return f'欠け: {miss}'
    t = d.get('title', '')
    if t and '｜' not in t:
        return '題名に「｜」が無い'
    if len(t) > 34:
        return f'題名が長い({len(t)}字)'
    if re.search(r'当社の(導入)?(事例|実績)|お客様の声|導入事例', json.dumps(d, ensure_ascii=False)):
        return '実績・事例を書いている'
    return ''


def ask(prompt, check, model='sonnet', tries=3):
    """JSON を返すまで最大 tries 回。戻り値は (dict|None, 理由)。"""
    last = ''
    for _ in range(tries):
        try:
            r = subprocess.run(['claude', '-p', '--model', model, '--tools', '', '--no-session-persistence',
                                '--output-format', 'text'],
                               input=prompt + (f'\n\n前回の出力は不合格でした（{last}）。直して出力してください。' if last else ''),
                               capture_output=True, text=True, timeout=600, cwd='/tmp')
        except subprocess.TimeoutExpired:
            last = 'タイムアウト'; continue
        t = re.sub(r'^```(?:json)?\s*|\s*```$', '', r.stdout.strip())
        try:
            d = json.loads(t[t.index('{'):t.rindex('}') + 1])
        except Exception:
            if 'limit' in (t + r.stderr).lower():
                return None, f'利用上限: {t[:200]}'
            last = f'JSONとして読めない: {t[:120]!r}'; continue
        err = check(d)
        if err:
            last = err; continue
        d['_generated'] = time.strftime('%Y-%m-%d')
        return d, 'ok'
    return None, last


def run_batch(jobs_list, out_of, make, jobs=4, force=False, limit=0):
    """jobs_list: キーの列。out_of(key)->Path。make(key)->(dict|None, 理由)。"""
    keys = [k for k in jobs_list if force or not out_of(k).exists()]
    if limit:
        keys = keys[:limit]
    print(f'{len(keys)}件を作ります', flush=True)
    ng = 0

    def one(k):
        d, why = make(k)
        if d is not None:
            p = out_of(k); p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        return k, why

    with cf.ThreadPoolExecutor(jobs) as ex:
        for n, fut in enumerate(cf.as_completed([ex.submit(one, k) for k in keys]), 1):
            k, why = fut.result()
            print(f'[{n}/{len(keys)}] {k} {"ok" if why == "ok" else "NG " + why}', flush=True)
            if why != 'ok':
                ng += 1
                if why.startswith('利用上限'):
                    print('利用上限に当たったので止めます', flush=True); os._exit(2)
    print(f'終わり: NG {ng}件', flush=True)
    return ng
