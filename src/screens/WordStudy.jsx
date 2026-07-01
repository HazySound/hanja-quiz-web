import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { loadHanja, readingFor, gradeSA } from '../lib/hanja.js'
import * as wordbook from '../lib/wordbook.js'

// 단어장 컬렉션을 암기(플래시카드)/문제풀기(읽기 입력)로 학습. words=[[한자어,읽기,뜻],...]
function shuffle(a) {
  a = [...a]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 단어 속 각 한자의 훈음 풀이: 街頭 → 街(거리 가) , 頭(머리 두)
function partsOf(word) {
  const [hj, rd] = word
  const seen = new Set()
  const parts = []
  for (let i = 0; i < hj.length; i++) {
    const c = hj[i]
    if (seen.has(c)) continue
    seen.add(c)
    parts.push(`${c}(${readingFor(c, rd[i] || '')})`)
  }
  return parts.join('   ,   ')
}

export default function WordStudy({ words, mode, title, onBack }) {
  const [, setReady] = useState(false)
  useEffect(() => {
    loadHanja().then(() => setReady(true)) // readingFor(풀이)용
  }, [])

  const [deck] = useState(() => (mode === 'quiz' ? shuffle(words) : words))
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false) // 암기: 읽기 공개
  const [input, setInput] = useState('') // 문제: 입력
  const [graded, setGraded] = useState(false)
  const [ok, setOk] = useState(false)
  const [correctN, setCorrectN] = useState(0)
  const [done, setDone] = useState(false)

  const w = deck[i]
  const more = i + 1 < deck.length

  function move(d) {
    setI((p) => (p + d + deck.length) % deck.length)
    setRevealed(false)
  }
  function submit() {
    if (graded) return
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const { allOk } = gradeSA([w[1]], [input])
    setOk(allOk)
    setGraded(true)
    if (allOk) setCorrectN((n) => n + 1)
    // 출제/정답 횟수 기록 + 오답 단어 적립(맞히면 '맞힘' 표시, 자동 제거 X).
    wordbook.recordWord(w[0], w[1], w[2] || '', allOk)
  }
  function nextQ() {
    if (more) {
      setI(i + 1)
      setInput('')
      setGraded(false)
    } else {
      setDone(true)
    }
  }

  const promptCls = `hanja leading-none ${w && w[0].length >= 3 ? 'text-5xl' : 'text-6xl'}`

  // ----- 문제: 결과 -----
  if (mode === 'quiz' && done) {
    const pct = deck.length ? Math.round((correctN / deck.length) * 100) : 0
    return (
      <Shell title={title} onBack={onBack}>
        <div className="rounded-2xl bg-gradient-to-br from-accent/20 to-card p-6 text-center border border-accent/30">
          <div className="text-muted text-sm">정답</div>
          <div className="mt-1 text-4xl font-bold">
            {correctN}
            <span className="text-muted text-2xl"> / {deck.length}</span>
          </div>
          <div className="text-gold mt-1 text-sm">정답률 {pct}%</div>
        </div>
        <button onClick={onBack} className="bg-accent mt-6 w-full rounded-2xl py-3.5 font-bold text-white">
          목록으로
        </button>
      </Shell>
    )
  }

  if (!w) {
    return (
      <Shell title={title} onBack={onBack}>
        <p className="text-muted text-sm">단어가 없어요.</p>
      </Shell>
    )
  }

  // ----- 암기(플래시카드) -----
  if (mode === 'flash') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.18 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Header title={title} onBack={onBack} sub={`${i + 1} / ${deck.length}`} />
        <div className="screen-scroll">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              <button
                onClick={() => setRevealed((v) => !v)}
                className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-2xl bg-card py-8"
              >
                <span className="hanja text-6xl font-bold leading-none">{w[0]}</span>
                {revealed ? (
                  <span className="text-accent mt-5 text-xl">{w[1]}</span>
                ) : (
                  <span className="text-muted mt-5 text-sm">탭하여 읽기 보기</span>
                )}
              </button>
              {revealed && (
                <div className="mt-3 rounded-xl bg-card/60 p-3">
                  <div className="text-sm">
                    <span className="text-muted">풀이  </span>
                    <span className="hanja">{partsOf(w)}</span>
                  </div>
                  {w[2] && <div className="text-muted mt-1.5 text-xs leading-relaxed">{w[2]}</div>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex shrink-0 items-center gap-3">
          <button onClick={() => move(-1)} className="flex-1 rounded-2xl bg-card py-3.5 font-bold hover:bg-card-hover">
            ◀ 이전
          </button>
          <span className="text-muted w-20 text-center text-sm">
            {i + 1} / {deck.length}
          </span>
          <button onClick={() => move(1)} className="bg-accent flex-1 rounded-2xl py-3.5 font-bold text-white hover:opacity-90">
            다음 ▶
          </button>
        </div>
      </motion.div>
    )
  }

  // ----- 문제(읽기 입력) -----
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col"
    >
      <Header title={title} onBack={onBack} sub={`${i + 1} / ${deck.length} · 정답 ${correctN}`} />
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card py-4 text-center">
            <div className={promptCls}>{w[0]}</div>
            <div className="text-muted mt-2 text-sm">단어를 읽어 보세요</div>
          </div>
          <div className="text-muted -mt-2 text-center text-xs">
            출제 {wordbook.wordStats(w[0]).seen}회 · 정답 {wordbook.wordStats(w[0]).correct}회
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !graded && submit()}
            disabled={graded}
            placeholder="읽기 (예: 가두)"
            autoComplete="off"
            autoCapitalize="off"
            className={`w-full rounded-2xl border-2 bg-card p-4 text-base outline-none placeholder:text-muted ${
              !graded ? 'border-transparent focus:border-accent' : ok ? 'border-good/60 bg-good/15' : 'border-bad/60 bg-bad/15'
            }`}
          />
          {graded && (
            <div className="rounded-xl bg-card/60 p-3">
              <div className="text-muted mb-1 text-sm">정답: {w[1]}</div>
              <div className="text-sm">
                <span className="text-muted">풀이  </span>
                <span className="hanja">{partsOf(w)}</span>
              </div>
              {w[2] && <div className="text-muted mt-1.5 text-xs leading-relaxed">{w[2]}</div>}
            </div>
          )}
          <button
            onClick={() => (graded ? nextQ() : submit())}
            className="bg-accent w-full rounded-2xl py-3.5 font-bold text-white hover:opacity-90"
          >
            {!graded ? '채점' : more ? '다음' : '결과 보기'}
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

function Header({ title, onBack, sub }) {
  const nav = useNavigate()
  return (
    <div className="shrink-0">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} className="rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
          ◀ 뒤로
        </button>
        <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">
          🏠
        </button>
      </div>
      <h1 className="mb-1 text-xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="text-muted mb-3 text-sm">{sub}</p>}
    </div>
  )
}
function Shell({ title, onBack, children }) {
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="flex flex-col">
      <Header title={title} onBack={onBack} />
      {children}
    </motion.div>
  )
}
