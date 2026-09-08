#!/usr/bin/env python3
"""政治・政策キーワードページの本文を、ローカル gemma4（192.168.0.3・think:false）で作る。

  /usr/bin/python3 scripts/politech-copy.py            # 未生成分だけ（再開可能）
  /usr/bin/python3 scripts/politech-copy.py --limit 5  # 試し

入力: data/politech-keywords.json　出力: data/politech-copy.json（slug → 本文JSON）
方針: 数字は当社の実測（検索数）と各テーマの事実表だけ。制度の金額や期限をモデルに書かせない。
      特定の政党・候補者の支持・批判を書かない（全方位等距離）。当社が持っていない道具を「ある」と書かない。
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KW = os.path.join(ROOT, "data", "politech-keywords.json")
OUT = os.path.join(ROOT, "data", "politech-copy.json")
OLLAMA = "http://192.168.0.3:11434/api/generate"
MODEL = "gemma4:12b-it-qat"

FACTS = {
    "bousai": "当社の道具: Kurage 土砂災害ハザードマップ（住所→警戒区域/特別警戒区域を判定）、津波浸水想定マップ（住所→浸水深と海抜）、避難所マップ（災害種別で使える避難所まで徒歩何分か）。いずれも名古屋市版デモが無料で触れ、買い切り版55,000円（税込）を政党・議員事務所が『事務所の名前』で公開できる。感震ブレーカーや耐震改修の助成は制度ナビ（名古屋市版）に収録。",
    "kosodate": "当社の道具: Kurage 制度ナビ（困りごと→児童手当・子ども医療費・就学援助などの制度を、区役所の課・電話・期限・必要書類・出典つきで案内。相談記録つき）。保育園の空き状況・学童・子ども食堂の一覧は当社の道具には無い（AI-IT顧問契約で自治体版を組める）。",
    "shussan": "当社の道具: Kurage 制度ナビ（出産・子育ての給付や手当を、申請先・期限・必要書類・出典つきで案内。名古屋市版45制度）。給付金の最新情報は必ず出典（自治体・国の公式ページ）で確認する前提。",
    "kyoiku": "当社の道具: Kurage 制度ナビ（就学援助・高校の給付型奨学金・入学支援金・高等教育の修学支援新制度などを申請先・期限つきで案内）。奨学金の申込先は在学校や日本学生支援機構であり、当社は仲介しない。",
    "futoko": "当社の道具: 制度ナビの型で『教育支援センター（適応指導教室）・フリースクールの一覧＋出席扱いの条件』を自治体版として組める（名古屋市版は未収録、AI-IT顧問契約の範囲）。不登校の相談先は各自治体の教育委員会・教育支援センター。",
    "fukushi": "当社の道具: Kurage 制度ナビ（ひとり親の手当・医療費助成、生活保護の申請窓口、障害者医療費助成、高齢者の減免・給付を、区役所の課・電話・必要書類・出典つきで案内。相談記録つき）。",
    "seikatsu": "当社の道具: Kurage 制度ナビ（給付金・非課税世帯向け制度・住居確保給付金・空き家の補助を申請先・期限つきで案内）、Kurage 通報先ナビ（ごみ・道路・街灯・不法投棄の『どこに言えばいい』に住所で答える）。給付金の最新情報は出典で確認する前提。",
    "senkyo": "当社の道具: 期日前投票所の案内ページは当社の既製品には無いが、通報先ナビと同じ型（区→場所・時間・持ち物）で組める。情報公開請求はAlaveteli日本語導入キット、政治資金の会計・領収書はkbilling/kinvoice。投票の案内は中立の表現に徹する。",
    "chiiki": "当社の道具: Kurage 制度ナビ（防犯カメラ設置補助などの制度を申請先つきで案内）、Kurage 商圏分析（住所→徒歩圏の人口・年齢構成。街頭活動や人口減少の把握に）、通報先ナビ。移住支援金は各自治体の制度で当社の道具には無い。",
    "nagoya": "当社の道具（名古屋市版・無料デモ）: 通報先ナビ（16区の土木事務所・環境事業所）、制度ナビ（45制度）、施設検索（スポーツセンター15＋中学校体育館111校の個人利用）、土砂災害・津波・避難所マップ。休日急病診療所や保育園の空きは市の公式案内があり、当社の道具には無い。",
}
COMMON = "共通の事実: 当社（株式会社エクスブリッジ・名古屋）は架空政党『Kurage党』を実験場として住民サービスのページを先に動かし、全政党・全会派・無所属・政治団体・議員事務所に同じ条件で提供する。AI-IT顧問契約（月15時間・税別150,000円・名古屋市内限定）は政党・政治団体も対象で、キャンペーン期間中はKurage App Storeの商品代金が無料。名古屋市外は買い切り商品と導入キットを全国で使える。"

PROMPT = """あなたは日本の地方政治と行政制度に詳しい編集者です。検索語「{kw}」で検索した人（月におよそ{vol}回検索されています）に向けて、政党・政治団体・議員事務所が「動くページと道具」で応える解説ページの本文を書きます。

テーマ: {theme_name}／検索意図の型: {intent}
{facts}
{common}

守ること:
- 制度の金額・期限・要件の具体的な数字を書かない（「自治体の公式ページで確認する」と書く）。上の事実に無い道具や実績を「ある」と書かない。
- 特定の実在政党・候補者・人物の名前を出さない。支持も批判もしない。
- 読者は住民または政治団体の担当者。丁寧語。専門用語は一度だけ短く説明する。
- 各項目は日本語のプレーンテキスト。マークダウン記号や箇条書き記号を入れない。

次のJSONだけを出力してください（前後に説明を付けない）:
{{"title": "検索語を含む32字以内のページ題",
 "h1": "検索語を含む40字以内の見出し（読者の問いに答える言い切り）",
 "lead": "140〜180字。この検索語で人が何に困っていて、このページで何が分かるか",
 "points": ["知りたいこと1（30字以内）", "知りたいこと2", "知りたいこと3"],
 "answer": ["段落1（180〜260字。検索語の意味と、住民が実際に取る行動）", "段落2（180〜260字。政党・議員事務所がここで果たせる役割。上の道具の事実に沿って）"],
 "steps": [{{"t": "ステップ1の題（16字以内）", "b": "60〜90字"}}, {{"t": "ステップ2の題", "b": "60〜90字"}}, {{"t": "ステップ3の題", "b": "60〜90字"}}],
 "faq": [{{"q": "検索語に関する質問1", "a": "80〜140字"}}, {{"q": "質問2", "a": "80〜140字"}}, {{"q": "質問3（政党・議員事務所が使う場合）", "a": "80〜140字"}}]}}"""


def ollama(prompt: str, retries: int = 3) -> str:
    body = json.dumps({"model": MODEL, "prompt": prompt, "stream": False, "think": False, "options": {"num_predict": 2200, "temperature": 0.5}}).encode()
    for i in range(retries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"}), timeout=300)
            return json.load(r).get("response", "")
        except Exception as e:  # noqa: BLE001
            print("  ollama error:", e, file=sys.stderr)
            time.sleep(5 * (i + 1))
    return ""


def _balance(s: str) -> str:
    """モデルが閉じ忘れた } ] を補う（文字列の中は無視。閉じ括弧の種類違いは期待側を先に補う）"""
    out, stack, in_str, esc = [], [], False, False
    pairs = {"{": "}", "[": "]"}
    for ch in s:
        if in_str:
            out.append(ch)
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in pairs:
            stack.append(pairs[ch])
        elif ch in "}]":
            if not stack:
                continue
            while stack and stack[-1] != ch:
                out.append(stack.pop())
            stack.pop()
        out.append(ch)
    out.extend(reversed(stack))
    return "".join(out)


def parse(txt: str) -> dict | None:
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        return None
    s = m.group(0)
    try:
        d = json.loads(s)
    except json.JSONDecodeError:
        d = None
        for s2 in (re.sub(r",\s*([}\]])", r"\1", s), re.sub(r",\s*([}\]])", r"\1", _balance(s))):
            try:
                d = json.loads(s2)
                break
            except json.JSONDecodeError:
                continue
        if d is None:
            return None
    need = ["title", "h1", "lead", "points", "answer", "steps", "faq"]
    if not all(k in d for k in need):
        return None
    # 形の揺れを吸収: 文字列→段落分割、dict→list、steps/faq のキー名違い
    if isinstance(d["answer"], str):
        d["answer"] = [x.strip() for x in re.split(r"\n+", d["answer"]) if x.strip()]
    if isinstance(d["points"], str):
        d["points"] = [x.strip("・- ") for x in re.split(r"[\n、]", d["points"]) if x.strip()]
    for key, a, b in (("steps", "t", "b"), ("faq", "q", "a")):
        v = d[key]
        if isinstance(v, dict):
            v = [{"t" if key == "steps" else "q": kk, "b" if key == "steps" else "a": vv} for kk, vv in v.items()]
        out = []
        for it in v:
            if isinstance(it, dict):
                ks = list(it.keys())
                if a not in it and len(ks) >= 2:
                    it = {a: it[ks[0]], b: it[ks[1]]}
                out.append(it)
        d[key] = out
    if len(d["answer"]) == 1 and len(d["answer"][0]) > 200:
        t = d["answer"][0]; cut = t.rfind("。", 0, len(t) // 2 + 60) + 1
        d["answer"] = [t[:cut].strip(), t[cut:].strip()] if 0 < cut < len(t) - 40 else [t, t]
    if len(d["points"]) < 3 or len(d["answer"]) < 2 or len(d["steps"]) < 3 or len(d["faq"]) < 3:
        return None
    return d


def clean(s: str) -> str:
    return re.sub(r"[*#`>]+", "", str(s)).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--redo", default="", help="slug をカンマ区切りで再生成")
    a = ap.parse_args()
    kws = json.load(open(KW, encoding="utf-8"))
    out = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    redo = set(a.redo.split(",")) if a.redo else set()
    todo = [k for k in kws if k["slug"] not in out or k["slug"] in redo]
    if a.limit:
        todo = todo[: a.limit]
    print(f"対象 {len(todo)} / 全 {len(kws)}（生成済み {len(out)}）")
    t0 = time.time()
    for i, k in enumerate(todo, 1):
        p = PROMPT.format(kw=k["keyword"], vol=f"{k['volume']:,}", theme_name=k["theme_name"], intent=k["intent"], facts=FACTS[k["theme"]], common=COMMON)
        d = None
        raw = ""
        for attempt in range(4):
            raw = ollama(p)
            d = parse(raw)
            if d:
                break
        if not d:
            os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)
            open(os.path.join(ROOT, "logs", f"politech-fail-{k['slug']}.txt"), "w", encoding="utf-8").write(raw)
        if not d:
            print(f"  [{i}] {k['slug']} 失敗", file=sys.stderr)
            continue
        d = {kk: ([clean(x) if isinstance(x, str) else {kk2: clean(v2) for kk2, v2 in x.items()} for x in vv] if isinstance(vv, list) else clean(vv)) for kk, vv in d.items()}
        d["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        out[k["slug"]] = d
        json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        el = time.time() - t0
        print(f"  [{i}/{len(todo)}] {k['slug']} OK ({el/i:.0f}s/件, 残り目安 {(len(todo)-i)*el/i/60:.0f}分)", flush=True)
    print("DONE", len(out))


if __name__ == "__main__":
    main()
