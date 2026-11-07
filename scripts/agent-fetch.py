#!/usr/bin/python3
"""Kurage AIエージェント開発トラッカー（exbridge.jp/agent/）の材料を集める。2026-11-07 作成。

何のためか（ユーザー「Jevが話題になったみたいに、話題になってる技術情報がいいんだけど」
「最近だとgrok bot とかdotsとか、トレンドな技術ってあるよね」）:
脆弱性やモデルの一覧ではなく、「いま開発者の間で話題になっているAIエージェントの技術」を毎日拾う。

拾うもの:
  1. 大手の発表        data/agent/launches.json（手で確かめて書く。Grok Bot・dots など）
  2. 急に伸びたOSS     GitHub 検索。直近45日に作られたエージェント関連のリポジトリを★の伸び（1日あたり）で並べる
                       ＋ data/agent/pinned.json（Jev など、45日より前でも見続けるもの）
  3. 開発者の話題      Hacker News（Algolia API）。直近14日・点数の高い記事
各リポジトリは README の先頭を読み、「手元のモデルで動くか」「外部のAIサービスのキーが要るか」を語で判定し、
日本語の説明（1〜2文）を gemma4（0.3直・think:false）で付ける。説明は中身が変わらない限り作り直さない。

出力: data/agent/items.json ／ ★の記録 data/agent/stars/<日付>.json（前日比を出すため）
  /usr/bin/python3 scripts/agent-fetch.py
"""
import base64, datetime as dt, hashlib, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data', 'agent')
OUT = os.path.join(D, 'items.json')
JA = os.path.join(D, 'ja-cache.json')
OLLAMA = 'http://192.168.0.3:11434/api/generate'
MODEL = 'gemma4:12b-it-qat'
JST = dt.timezone(dt.timedelta(hours=9))
TODAY = dt.datetime.now(JST).date()

# エージェント開発の話題かどうか（説明文・名前・トピック）
AGENT = re.compile(r'(?i)\bagents?\b|agentic|\bmcp\b|model context protocol|claude[ -]?code|\bcodex\b|\bcursor\b|claude skill|\bskills?\b.*(claude|codex|agent)|browser[- ]use|computer[- ]use|web agent|coding agent|harness|sub-?agent|multi-agent|autonomous')
NG = re.compile(r'(?i)nsfw|porn|hentai|jailbreak|crack|airdrop|casino|gambl|day[- ]?trad|crypto|token launch|meme ?coin')
QUERIES = ['agent', 'agents', 'mcp', 'claude', 'codex', 'skill', 'browser agent', 'coding agent']


def gh(path, **params):
    args = ['gh', 'api', '-X', 'GET', path] + sum((['-f', f'{k}={v}'] for k, v in params.items()), [])
    r = subprocess.run(args, capture_output=True, text=True, timeout=60)
    if r.returncode:
        print('gh失敗', path, r.stderr[:200], file=sys.stderr)
        return None
    return json.loads(r.stdout)


def readme(full):
    r = gh(f'repos/{full}/readme')
    if not r or 'content' not in r:
        return ''
    try:
        return base64.b64decode(r['content']).decode('utf-8', 'replace')[:12000]
    except Exception:
        return ''


LOCAL = re.compile(r'(?i)ollama|llama\.cpp|llamacpp|vllm|lm ?studio|local[- ]first|on[- ]device|runs? (fully )?locally|local models?|offline|mlx\b|gguf|self[- ]host')
KEYS = re.compile(r'(OPENAI|ANTHROPIC|GEMINI|GOOGLE|XAI|DEEPSEEK|OPENROUTER|GROQ|MISTRAL|TYPESAFE|PERPLEXITY)_API_KEY')
TELEMETRY = re.compile(r'(?i)telemetry|posthog|analytics are collected|usage data')


def judge(text):
    keys = sorted(set(m.group(1) for m in KEYS.finditer(text)))
    return {'local': bool(LOCAL.search(text)), 'keys': keys, 'telemetry': bool(TELEMETRY.search(text))}


def gemma(prompt, n=400):
    body = json.dumps({'model': MODEL, 'prompt': prompt, 'stream': False, 'think': False,
                       'options': {'temperature': 0.2, 'num_predict': n}}).encode()
    req = urllib.request.Request(OLLAMA, body, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.load(r).get('response', '').strip()


def ja_of(key, src, kind):
    cache = json.load(open(JA, encoding='utf-8')) if os.path.exists(JA) else {}
    hsh = hashlib.sha1(src.encode()).hexdigest()[:12]
    if cache.get(key, {}).get('h') == hsh:
        return cache[key]
    if kind == 'repo':
        p = ('次の GitHub リポジトリが何かを、日本の会社の担当者向けに日本語で説明してください。\n'
             '出力は JSON だけ: {"name_ja": "15字以内の呼び名（例: ブラウザ操作エージェント）", "what": "何をするものかを1〜2文・80〜140字。誇張しない。READMEに無いことを書かない"}\n\n' + src[:6000])
    else:
        p = ('次の Hacker News の記事の題名を日本語にし、何の話かを1文で説明してください。\n'
             '出力は JSON だけ: {"title_ja": "題名の日本語訳（60字以内）", "what": "何の話か1文・60〜100字。題名から分かる範囲だけ"}\n\n' + src[:2000])
    try:
        t = gemma(p)
        t = re.sub(r'^```(json)?|```$', '', t.strip(), flags=re.M).strip()
        v = json.loads(t[t.index('{'):t.rindex('}') + 1])
    except Exception as e:
        print('gemma失敗', key, e, file=sys.stderr)
        return cache.get(key, {})
    v['h'] = hsh
    cache[key] = v
    json.dump(cache, open(JA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return v


def repos():
    since = (TODAY - dt.timedelta(days=45)).isoformat()
    seen = {}
    for q in QUERIES:
        r = gh('search/repositories', q=f'{q} in:name,description,topics created:>{since} stars:>500', sort='stars', order='desc', per_page=50)
        for it in (r or {}).get('items', []):
            seen[it['full_name']] = it
        time.sleep(2)   # 検索APIは1分30回まで
    pinned = json.load(open(os.path.join(D, 'pinned.json'), encoding='utf-8'))['repos'] if os.path.exists(os.path.join(D, 'pinned.json')) else []
    for p in pinned:
        if p['repo'] not in seen:
            it = gh(f"repos/{p['repo']}")
            if it:
                seen[p['repo']] = it
    pin = {p['repo']: p for p in pinned}
    out = []
    for full, it in seen.items():
        text = ' '.join([it.get('name', ''), it.get('description') or '', ' '.join(it.get('topics') or [])])
        if NG.search(text) or (full not in pin and not AGENT.search(text)):
            continue
        out.append(it)
    return out, pin


def stars_history():
    hist = {}
    sd = os.path.join(D, 'stars')
    os.makedirs(sd, exist_ok=True)
    for f in sorted(os.listdir(sd)):
        if f.endswith('.json'):
            hist[f[:-5]] = json.load(open(os.path.join(sd, f)))
    return hist, sd


def hn():
    since = int(time.time()) - 14 * 86400
    seen = {}
    for q in ['AI agent', 'agents', 'MCP', 'Claude Code', 'Codex', 'coding agent', 'browser agent', 'Cursor', 'Grok Bot', 'OpenAI dots']:
        u = 'https://hn.algolia.com/api/v1/search?' + urllib.parse.urlencode({'query': q, 'tags': 'story', 'numericFilters': f'created_at_i>{since},points>150', 'hitsPerPage': 30})
        try:
            with urllib.request.urlopen(u, timeout=30) as r:
                for h in json.load(r)['hits']:
                    # 「agents」だけだと捜査官などの記事が混じる（国土安全保障省の流出が入った）。AIの語がある題名だけ
                    if re.search(r'(?i)\bAI\b|\bLLMs?\b|claude|codex|openai|\bgpt|cursor|\bmcp\b|grok|gemini|anthropic|deepseek|copilot|agentic|coding agent|browser agent', h['title']):
                        seen[h['objectID']] = h
        except Exception as e:
            print('HN失敗', q, e, file=sys.stderr)
    return sorted(seen.values(), key=lambda h: -h['points'])[:30]


def main():
    launches = json.load(open(os.path.join(D, 'launches.json'), encoding='utf-8'))['launches']
    rs, pin = repos()
    hist, sd = stars_history()
    snap = {it['full_name']: it['stargazers_count'] for it in rs}
    json.dump(snap, open(os.path.join(sd, f'{TODAY}.json'), 'w'))
    prev_days = [d for d in sorted(hist) if d < TODAY.isoformat()]
    prev = hist[prev_days[-1]] if prev_days else {}
    prev7 = next((hist[d] for d in reversed(prev_days) if d <= (TODAY - dt.timedelta(days=7)).isoformat()), {})
    items = []
    for it in rs:
        full = it['full_name']
        created = it['created_at'][:10]
        age = max(1, (TODAY - dt.date.fromisoformat(created)).days)
        rd = readme(full)
        j = judge(rd + ' ' + (it.get('description') or ''))
        ja = ja_of(full, f"{full}\n{it.get('description') or ''}\n\n{rd[:5000]}", 'repo')
        text = f"{it.get('description') or ''} {rd[:3000]}"
        rel = [l['slug'] for l in launches if re.search(l['alts'], text)]
        s = it['stargazers_count']
        items.append({
            'repo': full, 'slug': full.replace('/', '--').lower(), 'url': it['html_url'], 'desc': it.get('description') or '',
            'name_ja': ja.get('name_ja', ''), 'what': ja.get('what', ''), 'stars': s, 'created': created,
            'per_day': round(s / age), 'd1': (s - prev[full]) if full in prev else None, 'd7': (s - prev7[full]) if full in prev7 else None,
            'license': (it.get('license') or {}).get('spdx_id') or '', 'lang': it.get('language') or '', 'topics': it.get('topics') or [],
            'pushed': (it.get('pushed_at') or '')[:10], 'owner_type': (it.get('owner') or {}).get('type', ''),
            **j, 'related': rel, 'pinned': pin.get(full), 'homepage': it.get('homepage') or '',
        })
        time.sleep(0.5)
    items.sort(key=lambda x: -x['per_day'])
    news = []
    for h in hn():
        ja = ja_of('hn-' + h['objectID'], h['title'], 'hn')
        news.append({'id': h['objectID'], 'title': h['title'], 'title_ja': ja.get('title_ja', ''), 'what': ja.get('what', ''),
                     'url': h.get('url') or '', 'hn': f"https://news.ycombinator.com/item?id={h['objectID']}",
                     'points': h['points'], 'comments': h.get('num_comments') or 0, 'date': dt.datetime.fromtimestamp(h['created_at_i'], JST).date().isoformat()})
    out = {'generated_at': dt.datetime.now(JST).strftime('%Y-%m-%d %H:%M'), 'launches': launches, 'repos': items, 'hn': news}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'agent: 大手の発表 {len(launches)}・OSS {len(items)}・HN {len(news)} → {OUT}')


if __name__ == '__main__':
    main()
