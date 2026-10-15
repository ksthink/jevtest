/** 모든 페이지가 쓰는 스타일. 접근성용 숨김 클래스 이름은 공공기관 누리집에서 쓰는 그대로 둔다. */
const STYLE = `
:root{--line:#d8dee6;--ink:#1f2328;--brand:#1d4f91;--soft:#f4f6f8}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font-family:"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:15px;line-height:1.6}
a{color:#11458c}
header.gnb{background:var(--brand);color:#fff}
header.gnb .inner,main.wrap,footer.foot .inner{max-width:1040px;margin:0 auto;padding:0 16px}
header.gnb h1{margin:0;padding:18px 0 10px;font-size:20px}
header.gnb h1 a{color:#fff;text-decoration:none}
nav.menu{background:#16407a}
nav.menu ul{max-width:1040px;margin:0 auto;padding:0 16px;list-style:none;display:flex;gap:18px;flex-wrap:wrap}
nav.menu a{color:#fff;text-decoration:none;display:block;padding:10px 0;font-size:14px}
main.wrap{padding:20px 16px 48px}
h2.page-title{font-size:22px;border-bottom:2px solid var(--brand);padding-bottom:10px}
table.board-list{border-collapse:collapse;width:100%;font-size:14px}
table.board-list th,table.board-list td{border-bottom:1px solid var(--line);padding:9px 8px;text-align:center}
table.board-list thead th{background:var(--soft);border-top:2px solid var(--brand)}
table.board-list td.title{text-align:left}
.paging{margin:20px 0;text-align:center}
.paging a,.paging strong{display:inline-block;min-width:30px;padding:5px 6px;margin:0 2px;border:1px solid var(--line);text-decoration:none}
.paging strong{background:var(--brand);color:#fff;border-color:var(--brand)}
.lock{color:#888}
.view-head{border-top:2px solid var(--brand);padding:14px 4px;border-bottom:1px solid var(--line)}
.view-head h3{margin:0 0 6px;font-size:18px}
.view-meta{color:#666;font-size:13px}
.view-body{padding:18px 4px;min-height:160px;border-bottom:1px solid var(--line)}
.box{background:var(--soft);padding:12px;margin:12px 0}
.cmt{border-bottom:1px dashed var(--line);padding:10px 4px;font-size:14px}
.cmt .who{color:#444;font-weight:600;margin-right:8px}
.btns{margin:16px 0}
.btns a,.btns button{border:1px solid var(--line);background:var(--soft);padding:7px 14px;text-decoration:none;color:var(--ink);cursor:pointer}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;list-style:none;padding:0}
.cards li{border:1px solid var(--line)}
.cards .thumb{height:110px;background:linear-gradient(135deg,#dde6f2,#eef2f7)}
.cards .cap{padding:10px;font-size:14px}
footer.foot{margin-top:30px;border-top:1px solid var(--line);background:var(--soft);color:#555;font-size:13px}
footer.foot .inner{padding:16px}
.notice-box{border:1px solid #c8d4e3;background:#f7fafd;padding:14px 16px;margin:0 0 18px;font-size:14px}
.notice-box h3{margin:0 0 6px;font-size:15px}

/* 접근성용 숨김 */
.blind{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ir{font-size:0;line-height:0}
/* .box 안에서 쓰면 배경과 글자색이 같아진다(조상 요소를 따라가야 보이는 저대비) */
.same{color:var(--soft)}

/* 함정용 정상 UI 패턴 */
.gnb{list-style:none;padding:0}
.gnb-sub{display:none}
.tab-panel{display:none}
.tab-panel.on{display:block}
.acc-body{height:0;overflow:hidden}
.modal{display:none}
.slider{position:relative;overflow:hidden;height:44px}
.slide{position:absolute;left:0;top:0}
.slide.prev{transform:translateX(-100%)}
table.answer{border-collapse:collapse;width:100%;font-size:13px}
table.answer th,table.answer td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
table.answer thead th{background:var(--soft)}
code{background:#f1f3f5;padding:1px 4px;border-radius:3px;font-size:12px}
`;

module.exports = { STYLE };
