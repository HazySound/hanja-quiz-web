import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { loadHanja, loadExamples, exampleWords, readingFor, gradeSA, chosungOf } from '../lib/hanja.js'
import * as schedule from '../lib/schedule.js'
import * as session from '../lib/session.js'
import * as wordbook from '../lib/wordbook.js'
import JumpSheet from '../components/JumpSheet.jsx'

// 오늘 분량 한자들의 예시 단어로 '읽기(플래시)'/'문제'. 읽기만 해도 단어 완료로 기록.
// 셔플·위치는 읽기/문제 각각 독립. location.state: { ids, title, scheduleMark, fill } | { resume:true }

function shuffleArr(a) {
  a = [...a]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function partsOf(w) {
  const [hj, rd] = w
  const seen = new Set()
  const out = []
  for (let i = 0; i < hj.length; i++) {
    const c = hj[i]
    if (seen.has(c)) continue
    seen.add(c)
    out.push(`${c}(${readingFor(c, rd[i] || '')})`)
  }
  return out.join('   ,   ')
}
function buildBase(all, ids) {
  const byId = new Map(all.map((h) => [h.id, h]))
  const out = []
  for (const id of ids) {
    const h = byId.get(id)
    if (!h) continue
    const ws = exampleWords(h.c, 1)
    if (ws.length) out.push({ hanjaId: id, w: ws[0] })
  }
  return out
}
const blank = (ids) => ({ ids: [...ids], index: 0, shuffle: false })

export default function WordDaily() {
  const nav = useNavigate()
  const location = useLocation()
  const stateIds = location.state?.ids || null
  const scheduleMark = !!location.state?.scheduleMark
  const resume = !!location.state?.resume
  const isFill = !!location.state?.fill
  const reviewKey = location.state?.reviewKey || null // 복습이면 진도 슬롯
  const isReview = !!reviewKey
  const slot = isReview ? `rev:${reviewKey}:word` : 'word'
  const saveOn = (scheduleMark || isReview) && !isFill
  const title = location.state?.title || '단어'
  const fromSchedule = scheduleMark || resume

  const [all, setAll] = useState(null)
  const [ready, setReady] = useState(false)
  const [base, setBase] = useState([]) // [{hanjaId, w}] 원래 순서
  const [mode, setMode] = useState('read') // 'read' | 'quiz'
  const [st, setSt] = useState({ read: blank([]), quiz: blank([]) }) // 모드별 순서/위치/셔플(독립)
  const [marking, setMarking] = useState(scheduleMark)
  const [revealed, setRevealed] = useState(false)
  const [counted, setCounted] = useState(false)
  const [input, setInput] = useState('')
  const [graded, setGraded] = useState(false)
  const [ok, setOk] = useState(false)
  const [jumpOpen, setJumpOpen] = useState(false)

  useEffect(() => {
    Promise.all([loadHanja(), loadExamples()]).then(([h]) => { setAll(h); setReady(true) })
  }, [])

  // 초기화 — 이어서/스케줄이면 세션 복원, 아니면 전달 ids로.
  useEffect(() => {
    if (!ready || !all || base.length) return
    const sess = session.load(slot)
    const canResume = !isFill && sess?.baseIds?.length && (resume || isReview || (scheduleMark && sess.date === schedule.todayStr()))
    if (canResume) {
      setBase(buildBase(all, sess.baseIds))
      setSt({ read: sess.read || blank(sess.baseIds), quiz: sess.quiz || blank(sess.baseIds) })
      setMode(sess.wmode || 'read')
      setMarking(!!sess.scheduleMark)
    } else if (stateIds) {
      const b = buildBase(all, stateIds)
      const ids = b.map((x) => x.hanjaId)
      setBase(b)
      const init = { read: blank(ids), quiz: blank(ids) }
      setSt(init)
      if (scheduleMark) setMarking(true)
      if (saveOn) session.save(slot, { kind: 'word', baseIds: ids, read: init.read, quiz: init.quiz, wmode: 'read', scheduleMark, date: schedule.todayStr() })
    } else {
      nav('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, all])

  const byHid = new Map(base.map((x) => [x.hanjaId, x]))
  const cur = st[mode]
  const deck = cur.ids.map((id) => byHid.get(id)).filter(Boolean)
  const i = cur.index
  const shuffleOn = cur.shuffle
  const card = deck[i]

  // 위치/순서/모드 저장(이어서 하기). 스케줄 학습 또는 복습이면 저장.
  useEffect(() => {
    if (!(marking || isReview) || isFill || !base.length) return
    const sess = session.load(slot)
    if (sess) session.save(slot, { ...sess, baseIds: base.map((x) => x.hanjaId), read: st.read, quiz: st.quiz, wmode: mode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, mode, marking])

  const setCur = (patch) => setSt((s) => ({ ...s, [mode]: { ...s[mode], ...patch } }))
  const resetAnswer = () => { setRevealed(false); setCounted(false); setInput(''); setGraded(false) }

  function recordRead() {
    if (!card || counted) return
    if (marking) schedule.recordItem(card.hanjaId, 'word')
    setCounted(true)
  }
  function move(d) {
    if (!deck.length) return
    setCur({ index: (i + d + deck.length) % deck.length })
    resetAnswer()
  }
  function reveal() {
    setRevealed((v) => { if (!v) recordRead(); return !v })
  }
  function submit() {
    if (graded || !card) return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const { allOk } = gradeSA([card.w[1]], [input])
    setOk(allOk)
    setGraded(true)
    wordbook.recordWord(card.w[0], card.w[1], card.w[2] || '', allOk)
    if (marking && !counted) { schedule.recordItem(card.hanjaId, 'word'); setCounted(true) }
  }
  // 셔플 토글(현재 모드만): 켜면 랜덤, 끄면 원래 순서. 읽기/문제 각각 독립.
  function toggleShuffle() {
    const on = !shuffleOn
    const baseIds = base.map((x) => x.hanjaId)
    setCur({ ids: on ? shuffleArr(baseIds) : baseIds, index: 0, shuffle: on })
    resetAnswer()
  }
  function switchMode(m) { setMode(m); resetAnswer() }

  const back = () => (fromSchedule ? nav('/schedule') : location.state?.back ? nav('/schedule', { state: location.state.back }) : nav(-1))
  const backLabel = fromSchedule ? '일일 학습' : location.state?.back ? '캘린더' : '뒤로'

  if (!ready) return <Shell title={title} onBack={back}><p className="text-muted text-sm">불러오는 중…</p></Shell>
  if (!card) return <Shell title={title} onBack={back}><p className="text-muted text-sm">예시 단어가 있는 한자가 없어요.</p></Shell>

  const promptCls = `hanja leading-none ${card.w[0].length >= 3 ? 'text-5xl' : 'text-6xl'}`

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={back} className="rounded-xl bg-card px-3.5 py-2 text-sm hover:bg-card-hover">◀ {backLabel}</button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">🏠</button>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => switchMode('read')} className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'read' ? 'bg-accent text-white' : 'bg-card text-muted'}`}>🃏 읽기</button>
          <button onClick={() => switchMode('quiz')} className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'quiz' ? 'bg-accent text-white' : 'bg-card text-muted'}`}>📝 문제</button>
          <button onClick={toggleShuffle} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${shuffleOn ? 'bg-accent text-white' : 'bg-card text-muted'}`}>🔀 셔플</button>
          <button onClick={() => setJumpOpen(true)} className="text-muted shrink-0 rounded-xl bg-card px-3 py-2 text-sm">🔍 찾기</button>
        </div>
        <button onClick={() => setJumpOpen(true)} className="text-muted mb-2 text-sm underline-offset-2 hover:underline">{i + 1} / {deck.length}</button>
      </div>

      <div className="screen-scroll">
        <AnimatePresence mode="wait">
          <motion.div key={`${mode}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="flex flex-col gap-4">
            {mode === 'read' ? (
              <>
                <button onClick={reveal} className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-2xl bg-card py-8">
                  <span className={promptCls}>{card.w[0]}</span>
                  {revealed ? <span className="text-accent mt-5 text-xl">{card.w[1]}</span> : <span className="text-muted mt-5 text-sm">탭하여 읽기 보기</span>}
                </button>
                {revealed && (
                  <div className="rounded-xl bg-card/60 p-3">
                    <div className="text-sm"><span className="text-muted">풀이  </span><span className="hanja">{partsOf(card.w)}</span></div>
                    {card.w[2] && <div className="text-muted mt-1.5 text-xs leading-relaxed">{card.w[2]}</div>}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-card py-4 text-center">
                  <div className={promptCls}>{card.w[0]}</div>
                  <div className="text-muted mt-2 text-sm">단어를 읽어 보세요</div>
                </div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !graded && submit()}
                  disabled={graded}
                  placeholder="읽기 (예: 가두)"
                  autoComplete="off"
                  autoCapitalize="off"
                  className={`w-full rounded-2xl border-2 bg-card p-4 text-base outline-none placeholder:text-muted ${!graded ? 'border-transparent focus:border-accent' : ok ? 'border-good/60 bg-good/15' : 'border-bad/60 bg-bad/15'}`}
                />
                {graded && (
                  <div className="rounded-xl bg-card/60 p-3">
                    <div className="text-muted mb-1 text-sm">정답: {card.w[1]}</div>
                    <div className="text-sm"><span className="text-muted">풀이  </span><span className="hanja">{partsOf(card.w)}</span></div>
                    {card.w[2] && <div className="text-muted mt-1.5 text-xs leading-relaxed">{card.w[2]}</div>}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-3">
        {mode === 'quiz' && !graded ? (
          <button onClick={submit} className="bg-accent w-full rounded-2xl py-3.5 font-bold text-white hover:opacity-90">채점</button>
        ) : (
          <>
            <button onClick={() => move(-1)} className="flex-1 rounded-2xl bg-card py-3.5 font-bold hover:bg-card-hover">◀ 이전</button>
            <button onClick={() => setJumpOpen(true)} className="text-muted w-16 shrink-0 text-center text-sm underline-offset-2 hover:underline">{i + 1}/{deck.length}</button>
            <button onClick={() => move(1)} className="bg-accent flex-1 rounded-2xl py-3.5 font-bold text-white hover:opacity-90">다음 ▶</button>
          </>
        )}
      </div>

      <JumpSheet
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        items={jumpOpen ? (() => { const byAll = new Map((all || []).map((h) => [h.id, h])); return deck.map((d, idx) => { const sh = byAll.get(d.hanjaId); return { idx, label: d.w[0], sub: d.w[1], search: `${d.w[0]} ${d.w[1]}`, chapter: chosungOf(d.w[1]?.[0] || ''), radical: sh?.rad, radCh: sh?.radc } }) })() : []}
        onJump={(idx) => { setCur({ index: idx }); resetAnswer() }}
      />
    </motion.div>
  )
}

function Shell({ title, onBack, children }) {
  const nav = useNavigate()
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} className="rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">◀ 뒤로</button>
        <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">🏠</button>
      </div>
      <h1 className="mb-3 text-xl font-bold tracking-tight">{title}</h1>
      {children}
    </motion.div>
  )
}
