#!/usr/bin/env python3
"""/vibeblog/ のキーワード検索を本番で試す（2026-11-22）。使い捨ての headless Chrome で、語を入れて結果の数と先頭を数え、スマホ幅の画面も撮る。
  /usr/bin/python3 scripts/check_vibeblog_search.py [語 …]
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import websocket

URL = "https://exbridge.jp/vibeblog/"
words = sys.argv[1:] or ["相対性理論", "カブアンド", "ＯＳＳ", "kurage", "存在しない語ぴよぴよ"]
prof = tempfile.mkdtemp(prefix="vb-search-")
proc = subprocess.Popen(["google-chrome", "--headless=new", "--no-sandbox", f"--user-data-dir={prof}", "--remote-debugging-port=0", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        f = os.path.join(prof, "DevToolsActivePort")
        if os.path.exists(f):
            port = open(f).read().split()[0]; break
        time.sleep(0.2)
    page = next(t for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json")) if t["type"] == "page")
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60, suppress_origin=True)
    n = [0]
    def cmd(m, p=None):
        n[0] += 1; ws.send(json.dumps({"id": n[0], "method": m, "params": p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == n[0]: return r.get("result", {})
    def js(e):
        return cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}).get("result", {}).get("value")
    cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 900, "deviceScaleFactor": 2, "mobile": True})
    cmd("Page.navigate", {"url": URL}); time.sleep(4)
    for w in words:
        js(f"(()=>{{const q=document.getElementById('vbq'); q.value={json.dumps(w)}; q.dispatchEvent(new Event('input'));}})()")
        time.sleep(2.5)
        r = js("(()=>{const n=document.querySelector('#vbr .vs-n'); const a=[...document.querySelectorAll('#vbr a.vs-i .vs-t')].slice(0,2).map(x=>x.textContent); return [n?n.textContent:'(結果なし)', a, location.hash, document.documentElement.scrollWidth]})()")
        print(w, "→", r)
    js("document.getElementById('search').scrollIntoView({block:'start'})")
    time.sleep(0.5)
    open("/tmp/claude-1000/vb_search_390.png", "wb").write(base64.b64decode(cmd("Page.captureScreenshot", {"format": "png"})["data"]))
    # #q= のURLで開いたときに結果が出るか
    cmd("Page.navigate", {"url": URL + "#q=" + urllib.parse.quote("エコノミスト")}); time.sleep(5)
    print("#q=エコノミスト で開く →", js("(()=>{const n=document.querySelector('#vbr .vs-n'); return n?n.textContent:'(結果なし)'})()"))
finally:
    proc.terminate(); proc.wait(timeout=10); shutil.rmtree(prof, ignore_errors=True)
