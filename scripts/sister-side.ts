/**
 * 右の列（PR）を、国会トラッカー（xb4g.com/giin）と同じ構造で、論文トラッカー・省庁トラッカーにも出す（2026-10-23 ユーザー指示）。
 * 上から: PRの動画の枠（kpv_cm.js）→ 姉妹システムのバナー（自分以外）→ 災害に備えるシステム。
 * 広い画面（1100px以上）で2列、狭い画面では本文の下に回る。動画の枠はスマホでは本文の頭に別に置く（cmSp）。
 * 姉妹システムの並びと説明は xb4g/giin/lib/ui.php の g_side_open と揃える。片方だけ直さない。
 */
import { attr, h } from './page-shell'

export type Sister = 'tracker' | 'academic' | 'shocho' | 'kshuisho'

const SISTERS: { key: Sister; name: string; sub: string; url: string; img: string }[] = [
  { key: 'tracker', name: 'Kurage 国会トラッカー', sub: '150のテーマで、だれが質問し政府が何と答えたか', url: 'https://xb4g.com/giin/tracker', img: 'https://xb4g.com/giin/ogp.png?b=k3' },
  { key: 'academic', name: 'Kurage 論文トラッカー', sub: '東海・関東の大学の研究と、国会の議論をつなぐ', url: 'https://exbridge.jp/academic/', img: 'https://exbridge.jp/images/academic/index.png' },
  { key: 'shocho', name: 'Kurage 省庁トラッカー', sub: '各府省の新しい発表と、国会の議論を並べる', url: 'https://exbridge.jp/shocho/', img: 'https://exbridge.jp/images/shocho/index.png' },
  { key: 'kshuisho', name: 'Kurage 質問主意書アシスト', sub: '1947年からの質問主意書と答弁書を本文まで検索', url: 'https://kurage.exbridge.jp/kshuisho.php/', img: 'https://kurage.exbridge.jp/images/ogp/kshuisho.png' },
]

const DEMOS: [string, string, string][] = [
  ['kbousai', '防災AIチャット', '住所か現在地で、警報・避難・川と台風をまとめて'],
  ['kflood', '洪水・内水ハザードマップ', '住所で何メートル何日浸かるか'],
  ['khazard', '土砂災害ハザードマップ', '住所が警戒区域の中か'],
  ['ktsunami', '津波浸水想定マップ', '住所で津波の浸水の深さ'],
  ['krefuge', '避難所マップ', '住所から避難所まで徒歩何分'],
  ['kriskarea', '災害危険区域マップ', '建築基準法39条の区域か'],
  ['kmorido', '盛土規制区域マップ', '住所が盛土の規制区域か'],
  ['khisai', '被災者支援ナビ', '被災後に使える支援制度を状況から'],
]

export const SIDE_CSS = `<style>
.xcols{display:grid;grid-template-columns:minmax(0,1fr);gap:0}
.xmain{min-width:0}.xmain .wrap{width:auto;max-width:none}
.xside{min-width:0;padding:18px 0}
.xs-box{background:#fff;border:1px solid #e5ebf1;border-radius:14px;padding:12px 14px;margin:0 0 16px}
.xs-h{font-size:15px;margin:0 0 10px;padding:0;border:0}.xs-h small{font-size:11.5px;font-weight:700;color:#0a726b;margin-left:4px}
.xs-sis{display:grid;gap:10px}
.xs-sis a{display:block;text-decoration:none;color:#12202f;border:1px solid #eef2f5;border-radius:12px;overflow:hidden;background:#fff}
.xs-sis a:hover{border-color:#0a9a8f}
.xs-sis img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;background:#f3faf9}
.xs-sis b{display:block;font-size:13.5px;color:#0a726b;padding:8px 10px 0}.xs-sis span{display:block;font-size:12px;color:#5d6b7a;line-height:1.5;padding:2px 10px 9px}
.xs-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.xs-list a{display:block;text-decoration:none;color:#12202f;border:1px solid #eef2f5;border-radius:10px;padding:7px 10px}
.xs-list a:hover{border-color:#0a9a8f;background:#f3faf9}
.xs-list b{display:block;font-size:13.5px;color:#0a726b}.xs-list span{display:block;font-size:12px;color:#5d6b7a;line-height:1.5}
.xside .kpv-cm-box{margin:0 0 14px}
.x-cm-sp{margin:14px 0}
@media(min-width:1100px){.xcols{grid-template-columns:minmax(0,1fr) 300px;gap:28px;max-width:1360px;margin:0 auto;padding:0 20px}.xside{padding-top:26px}.x-cm-sp{display:none}}
@media(max-width:1099px){.xside{padding:0 16px 18px}.xside .kpv-cm{display:none}.xs-sis,.xs-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}}
</style>`

export const KPV_SCRIPT = '<script src="https://kurage.exbridge.jp/kpv_cm.js" defer></script>'

/** 右の列の中身。ref は計測の目印（#ref=<ref>-<相手>） */
export function sideHtml(current: Sister, ref: string): string {
  const sis = SISTERS.filter((s) => s.key !== current).map((s) =>
    `<a href="${attr(s.url)}#ref=${attr(ref)}-side-${s.key}"><img src="${attr(s.img)}" width="1200" height="630" loading="lazy" alt="${attr(s.name)}"><b>${h(s.name)}</b><span>${h(s.sub)}</span></a>`).join('')
  const demos = DEMOS.map(([k, n, d]) =>
    `<li><a href="https://kurage.exbridge.jp/${k}.php/#ref=${attr(ref)}-side-${k}"><b>${h(n)}</b><span>${h(d)}</span></a></li>`).join('')
  return `<aside class="xside" aria-label="当社のシステム"><div class="kpv-cm" data-ref="${attr(ref)}"></div>`
    + `<section class="xs-box"><h2 class="xs-h">国会・研究・省庁をつなぐ <small>Kurage</small></h2><div class="xs-sis">${sis}</div></section>`
    + `<section class="xs-box"><h2 class="xs-h">災害に備えるシステム</h2><ul class="xs-list">${demos}</ul>`
    + `<p style="font-size:11.5px;color:#8a97a5;margin:8px 0 0">株式会社エクスブリッジ（名古屋）</p></section></aside>`
}

/** 見出しより下（rest）を本文と右の列の2列にする。スマホでは本文の頭に動画の枠を置く */
export function withSide(rest: string, current: Sister, ref: string): string {
  return `<div class="xcols"><div class="xmain"><div class="kpv-cm x-cm-sp" data-ref="${attr(ref)}-sp"></div>${rest}</div>${sideHtml(current, ref)}</div>`
}
