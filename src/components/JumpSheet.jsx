import { useState } from 'react'
import { Sheet } from './Sheet.jsx'

// 덱 안에서 빠르게 이동: ① 번호 입력 점프 ② 검색(한자·훈·음) ③ 초성·부수 칩 필터(복수선택) → 탭하면 그 위치로.
// items: [{ idx, label, sub, search, chapter(초성), radical(부수번호), radCh(부수글자) }]
const CHO_ORDER = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'

export default function JumpSheet({ open, onClose, items, onJump }) {
  const [q, setQ] = useState('')
  const [chSet, setChSet] = useState(() => new Set())
  const [radSet, setRadSet] = useState(() => new Set())
  const [num, setNum] = useState('')

  const chaps = [...new Set(items.map((it) => it.chapter).filter(Boolean))].sort((a, b) => CHO_ORDER.indexOf(a) - CHO_ORDER.indexOf(b))
  const radList = []
  const radSeen = new Set()
  for (const it of items) {
    if (it.radical && !radSeen.has(it.radical)) { radSeen.add(it.radical); radList.push({ num: it.radical, ch: it.radCh }) }
  }
  radList.sort((a, b) => a.num - b.num)

  const qq = q.trim()
  const filtered = items.filter(
    (it) => (!chSet.size || chSet.has(it.chapter)) && (!radSet.size || radSet.has(it.radical)) && (!qq || (it.search || '').includes(qq)),
  )

  const toggle = (setter, v) => setter((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  const jump = (idx) => { onJump(idx); onClose() }
  const jumpNum = () => {
    const n = parseInt(num, 10)
    if (Number.isFinite(n) && n >= 1 && n <= items.length) { onJump(n - 1); onClose() }
  }

  return (
    <Sheet open={open} onClose={onClose} title="찾기">
      {/* 번호로 이동 */}
      <div className="mb-2 flex gap-2">
        <input value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && jumpNum()} type="number" inputMode="numeric" placeholder={`번호 (1~${items.length})`} className="flex-1 rounded-xl border-2 border-transparent bg-card-hover p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent" />
        <button onClick={jumpNum} className="bg-accent rounded-xl px-4 text-sm font-bold text-white">이동</button>
      </div>

      {/* 검색 */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 한자·훈·음 검색" autoComplete="off" className="mb-2 w-full rounded-xl border-2 border-transparent bg-card-hover p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent" />

      {/* 초성 칩(복수선택) */}
      {chaps.length > 0 && (
        <div className="scroll-x mb-2 flex gap-1.5 pb-1">
          <Chip on={!chSet.size} onClick={() => setChSet(new Set())}>초성</Chip>
          {chaps.map((c) => <Chip key={c} on={chSet.has(c)} onClick={() => toggle(setChSet, c)}>{c}</Chip>)}
        </div>
      )}

      {/* 부수 칩(복수선택) */}
      {radList.length > 0 && (
        <div className="scroll-x mb-2 flex gap-1.5 pb-1">
          <Chip on={!radSet.size} onClick={() => setRadSet(new Set())}>부수</Chip>
          {radList.map((r) => <Chip key={r.num} on={radSet.has(r.num)} onClick={() => toggle(setRadSet, r.num)}><span className="hanja">{r.ch}</span></Chip>)}
        </div>
      )}

      {/* 결과 — 영역 높이 고정(필터해도 안 줄어듦), 카드 수만 변함 */}
      <div className="text-muted mb-1 text-xs">{filtered.length}자</div>
      <div className="screen-scroll grid h-[42vh] grid-cols-4 content-start gap-1.5">
        {filtered.length ? (
          filtered.map((it) => (
            <button key={it.idx} onClick={() => jump(it.idx)} className="bg-card-hover hover:bg-card flex h-fit flex-col items-center rounded-lg px-1 py-2">
              <span className="hanja text-lg leading-none">{it.label}</span>
              {it.sub && <span className="text-muted mt-1 w-full truncate text-center text-[10px]">{it.sub}</span>}
            </button>
          ))
        ) : (
          <p className="text-muted col-span-4 py-4 text-center text-sm">결과 없음</p>
        )}
      </div>
    </Sheet>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold ${on ? 'bg-accent text-white' : 'bg-card-hover text-muted'}`}>
      {children}
    </button>
  )
}
