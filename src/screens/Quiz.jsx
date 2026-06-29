import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { loadHanja, buildRandomSession, H2R, R2H } from '../lib/hanja.js'
import { record } from '../lib/progress.js'

const COUNTS = [10, 20, 30, 50]
const DIRS = [
  { key: 'mix', label: '섞기' },
  { key: H2R, label: '한자→훈음' },
  { key: R2H, label: '훈음→한자' },
]

export default function Quiz() {
  const nav = useNavigate()
  const [all, setAll] = useState(null)
  const [error, setError] = useState(null)

  // phase: 'config' | 'play' | 'done'
  const [phase, setPhase] = useState('config')
  const [count, setCount] = useState(20)
  const [dir, setDir] = useState('mix')

  const [questions, setQuestions] = useState([])
  const [qi, setQi] = useState(0)
  const [answered, setAnswered] = useState(null) // 고른 보기 index
  const [results, setResults] = useState([]) // [{ q, correct }]

  useEffect(() => {
    loadHanja().then(setAll).catch((e) => setError(e.message))
  }, [])

  function start() {
    setQuestions(buildRandomSession(all, { count, dir }))
    setResults([])
    setQi(0)
    setAnswered(null)
    setPhase('play')
  }

  const q = questions[qi]
  const isHanjaOption = q?.dir === R2H // 보기가 한자 글자인지(아니면 훈음 텍스트)

  function select(i) {
    if (answered !== null) return
    const correct = i === q.answerIndex
    record(q.hanjaId, correct)
    setAnswered(i)
    setResults((r) => [...r, { q, correct }])
  }

  function next() {
    if (qi + 1 < questions.length) {
      setQi(qi + 1)
      setAnswered(null)
    } else {
      setPhase('done')
    }
  }

  // ----- 로딩 / 에러 -----
  if (error) {
    return (
      <Shell onBack={() => nav(-1)} title="랜덤 풀이">
        <p className="text-bad text-sm">{error}</p>
      </Shell>
    )
  }
  if (!all) {
    return (
      <Shell onBack={() => nav(-1)} title="랜덤 풀이">
        <p className="text-muted text-sm">한자 데이터를 불러오는 중…</p>
      </Shell>
    )
  }

  // ----- 설정 -----
  if (phase === 'config') {
    return (
      <Shell onBack={() => nav(-1)} title="랜덤 풀이">
        <p className="text-muted mb-6 text-sm">덜 풀어본 한자부터 무작위로 출제해요.</p>

        <Field label="문제 수">
          <Segmented options={COUNTS.map((c) => ({ key: c, label: String(c) }))} value={count} onChange={setCount} />
        </Field>
        <Field label="출제 방향">
          <Segmented options={DIRS} value={dir} onChange={setDir} />
        </Field>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={start}
          className="mt-4 w-full rounded-2xl bg-accent py-4 text-base font-bold text-white
                     ring-1 ring-accent/40 transition-opacity hover:opacity-90"
        >
          {count}문제 시작
        </motion.button>
      </Shell>
    )
  }

  // ----- 결과 -----
  if (phase === 'done') {
    const correct = results.filter((r) => r.correct).length
    const total = results.length
    const wrong = results.filter((r) => !r.correct)
    const pct = total ? Math.round((correct / total) * 100) : 0
    return (
      <Shell onBack={() => nav('/')} title="결과">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-card p-6 text-center ring-1 ring-accent/30">
          <div className="text-muted text-sm">정답</div>
          <div className="mt-1 text-4xl font-bold">
            {correct}
            <span className="text-muted text-2xl"> / {total}</span>
          </div>
          <div className="mt-1 text-sm text-gold">정답률 {pct}%</div>
        </div>

        {wrong.length > 0 && (
          <div className="mb-6">
            <div className="text-muted mb-2 text-sm">틀린 한자 ({wrong.length})</div>
            <div className="flex flex-col gap-2">
              {wrong.map(({ q: wq }, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <span className="hanja text-3xl">{wq.dir === H2R ? wq.prompt : wq.options[wq.answerIndex]}</span>
                  <span className="text-muted text-sm">
                    {wq.dir === H2R ? wq.options[wq.answerIndex] : wq.prompt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setPhase('config')}
            className="flex-1 rounded-2xl bg-accent py-3.5 font-bold text-white hover:opacity-90"
          >
            다시 풀기
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => nav('/')}
            className="flex-1 rounded-2xl bg-card py-3.5 font-bold hover:bg-card-hover"
          >
            메뉴로
          </motion.button>
        </div>
      </Shell>
    )
  }

  // ----- 풀이 (상단 고정 / 가운데 스크롤 / 하단 버튼 고정 3단) -----
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* 상단 고정: 뒤로 + 진행 */}
      <div className="shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => nav('/')}
            className="rounded-xl bg-card px-3.5 py-2 text-sm hover:bg-card-hover"
          >
            ◀ 뒤로
          </button>
          <span className="text-sm text-muted">정답 {results.filter((r) => r.correct).length}</span>
        </div>
        <div className="mb-1 text-sm text-muted">
          {qi + 1} / {questions.length}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(qi / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 가운데: 문제 + 보기. 넘치면 이 영역만 스크롤. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={qi}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* 문제 */}
            <div className="rounded-2xl bg-card py-7 text-center">
              <div className={q.dir === H2R ? 'brand-hanja text-7xl leading-none' : 'text-3xl font-bold'}>
                {q.prompt}
              </div>
              <div className="text-muted mt-3 text-sm">{q.sub}</div>
            </div>

            {/* 보기 */}
            <div className="flex flex-col gap-2.5">
              {q.options.map((opt, i) => (
                <motion.button
                  key={i}
                  whileTap={answered === null ? { scale: 0.98 } : undefined}
                  onClick={() => select(i)}
                  className={optionClass(i, answered, q.answerIndex)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className={isHanjaOption ? 'hanja text-2xl' : 'text-base'}>{opt}</span>
                    {answered !== null && <span className="text-muted text-sm">{q.notes[i]}</span>}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 하단 고정: 다음 버튼(자리 항상 예약 — 답 전엔 비활성, 위치 안 변함). */}
      <div className="shrink-0 pt-3">
        <button
          onClick={next}
          disabled={answered === null}
          className="w-full rounded-2xl py-3.5 font-bold transition-colors
                     bg-accent text-white hover:opacity-90
                     disabled:cursor-default disabled:bg-card disabled:text-muted disabled:hover:opacity-100"
        >
          {answered === null ? '정답을 고르세요' : qi + 1 < questions.length ? '다음' : '결과 보기'}
        </button>
      </div>
    </motion.div>
  )
}

// 보기 버튼 색: 정답=초록, 내가 고른 오답=빨강, 나머지=흐리게.
// ring(박스 바깥)이 아니라 border-2(박스 안)로 그린다 — 가운데 스크롤 영역이 가로로
// 클리핑해 ring 좌·우가 잘리는 문제 방지. 항상 같은 두께(투명↔유색)라 정렬·폭 안 변함.
function optionClass(i, answered, answerIndex) {
  const base = 'rounded-2xl border-2 p-4 text-left transition-colors'
  if (answered === null) return `${base} border-transparent bg-card hover:border-line hover:bg-card-hover`
  if (i === answerIndex) return `${base} border-good/60 bg-good/15`
  if (i === answered) return `${base} border-bad/60 bg-bad/15`
  return `${base} border-transparent bg-card/50 opacity-60`
}

// 공통 화면 틀(뒤로 + 제목 + 진입 모션).
function Shell({ onBack, title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
    >
      <button
        onClick={onBack}
        className="mb-4 self-start rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover"
      >
        ◀ 뒤로
      </button>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </motion.div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mb-5">
      <div className="text-muted mb-2 text-sm">{label}</div>
      {children}
    </div>
  )
}

// 세그먼트 선택(개수·방향). 선택된 칸만 accent.
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            value === o.key ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
