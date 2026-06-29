import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  loadHanja,
  buildRandomSession,
  gradeSA,
  gradeOptions,
  filterByGrade,
  MC,
  SA,
  H2R,
  R2H,
} from '../lib/hanja.js'
import { record } from '../lib/progress.js'

const COUNTS = [10, 20, 30, 50]
const FORMATS = [
  { key: MC, label: '객관식' },
  { key: SA, label: '단답식' },
]
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
  const [fmt, setFmt] = useState(MC)
  const [dir, setDir] = useState('mix')
  const [grade, setGrade] = useState(null) // null = 전체
  const [only, setOnly] = useState(false) // 배정한자만

  const [questions, setQuestions] = useState([])
  const [qi, setQi] = useState(0)
  const [results, setResults] = useState([]) // [{ q, correct }]

  // 객관식: 고른 보기 index. 단답식: 입력칸 값들 + 채점 여부/칸별 정오.
  const [selected, setSelected] = useState(null)
  const [inputs, setInputs] = useState([])
  const [graded, setGraded] = useState(false)
  const [saPer, setSaPer] = useState(null)

  useEffect(() => {
    loadHanja().then(setAll).catch((e) => setError(e.message))
  }, [])

  function start() {
    setQuestions(buildRandomSession(all, { count, dir, fmt, grade, only }))
    setResults([])
    setQi(0)
    resetAnswer()
    setPhase('play')
  }

  function resetAnswer() {
    setSelected(null)
    setInputs([])
    setGraded(false)
    setSaPer(null)
  }

  const q = questions[qi]
  const more = qi + 1 < questions.length
  const isAnswered = q?.fmt === SA ? graded : selected !== null

  // 객관식: 보기 탭 = 즉시 채점.
  function pick(i) {
    if (selected !== null) return
    const correct = i === q.answerIndex
    record(q.hanjaId, correct)
    setSelected(i)
    setResults((r) => [...r, { q, correct }])
  }

  // 단답식: 채점 버튼.
  function submitSA() {
    if (graded) return
    // 채점하면 키보드를 닫는다(입력 끝). VisualViewport가 복귀하며 레이아웃 원상복구.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const vals = q.answers.map((_, i) => inputs[i] || '')
    const { allOk, per } = gradeSA(q.answers, vals)
    record(q.hanjaId, allOk)
    setSaPer(per)
    setGraded(true)
    setResults((r) => [...r, { q, correct: allOk }])
  }

  function next() {
    if (more) {
      setQi(qi + 1)
      resetAnswer()
    } else {
      setPhase('done')
    }
  }

  function onBottom() {
    if (q.fmt === SA && !graded) submitSA()
    else if (isAnswered) next()
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
    const poolCount = filterByGrade(all, grade, only).length
    return (
      <Shell onBack={() => nav(-1)} title="랜덤 풀이">
        <p className="text-muted mb-6 text-sm">덜 풀어본 한자부터 무작위로 출제해요.</p>

        <Field label="문제 수">
          <Segmented options={COUNTS.map((c) => ({ key: c, label: String(c) }))} value={count} onChange={setCount} />
        </Field>
        <Field label="급수">
          <div className="flex flex-wrap gap-2">
            <Chip active={grade === null} onClick={() => setGrade(null)}>
              전체
            </Chip>
            {gradeOptions().map((o) => (
              <Chip key={o.grade} active={grade === o.grade} onClick={() => setGrade(o.grade)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <div className="text-muted mt-2 text-xs">출제 대상 {poolCount}자</div>
        </Field>
        {grade !== null && (
          <Field label="범위">
            <Segmented
              options={[
                { key: false, label: '누적' },
                { key: true, label: '배정한자만' },
              ]}
              value={only}
              onChange={setOnly}
            />
          </Field>
        )}
        <Field label="형식">
          <Segmented options={FORMATS} value={fmt} onChange={setFmt} />
        </Field>
        {fmt === MC && (
          <Field label="출제 방향">
            <Segmented options={DIRS} value={dir} onChange={setDir} />
          </Field>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={start}
          className="mt-4 w-full rounded-2xl bg-accent py-4 text-base font-bold text-white
                     ring-1 ring-accent/40 transition-opacity hover:opacity-90"
        >
          {count}문제 시작
        </motion.button>
        {/* 캐시/배포 확인용 임시 빌드 마커 — 새 버전이 적용되면 이 값이 보임. */}
        <div className="text-muted mt-3 text-center text-xs">build: kb-fix-4</div>
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
                    {wq.fmt === SA ? wq.answers.join(' / ') : wq.dir === H2R ? wq.options[wq.answerIndex] : wq.prompt}
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

  // ----- 풀이 -----
  const isHanjaOption = q.fmt === MC && q.dir === R2H // 보기가 한자 글자인지
  const bottomBtn = (
    <button
      onClick={onBottom}
      disabled={q.fmt === MC && selected === null}
      className="w-full rounded-2xl py-3.5 font-bold transition-colors
                 bg-accent text-white hover:opacity-90
                 disabled:cursor-default disabled:bg-card disabled:text-muted disabled:hover:opacity-100"
    >
      {bottomLabel(q, isAnswered, graded, more)}
    </button>
  )
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

      {q.fmt === SA ? (
        /* 단답식: 위에서부터 쌓는다 — 입력칸이 상단에 있으면 iOS가 화면을 밀어올리지 않음.
           아래 빈 공간을 키보드가 덮어도 문제·입력·버튼이 위에 그대로 보인다. */
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={qi}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* 문제(컴팩트) */}
              <div className="rounded-2xl bg-card py-6 text-center">
                <div className="brand-hanja text-6xl leading-none">{q.prompt}</div>
                <div className="text-muted mt-3 text-sm">{q.sub}</div>
              </div>

              {/* 입력칸 */}
              <div className="flex flex-col gap-2.5">
                {q.answers.map((ans, i) => (
                  <div key={i}>
                    <input
                      value={inputs[i] || ''}
                      onChange={(e) =>
                        setInputs((prev) => {
                          const nx = [...prev]
                          nx[i] = e.target.value
                          return nx
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !graded) submitSA()
                      }}
                      disabled={graded}
                      placeholder={q.answers.length > 1 ? `훈·음 ${i + 1}` : '훈·음 (예: 아름다울 가)'}
                      autoComplete="off"
                      autoCapitalize="off"
                      className={saInputClass(graded, saPer?.[i])}
                    />
                    {graded && <div className="text-muted mt-1 px-1 text-sm">정답: {ans}</div>}
                  </div>
                ))}
              </div>

              {/* 채점/다음 (입력 바로 아래) */}
              {bottomBtn}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* 객관식: 가운데 정렬 + 버튼 하단 고정 (키보드 없으니 3단 유지). */
        <>
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4"
            style={{ justifyContent: 'safe center' }}
          >
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
                      whileTap={selected === null ? { scale: 0.98 } : undefined}
                      onClick={() => pick(i)}
                      className={optionClass(i, selected, q.answerIndex)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className={isHanjaOption ? 'hanja text-2xl' : 'text-base'}>{opt}</span>
                        {selected !== null && <span className="text-muted text-sm">{q.notes[i]}</span>}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="shrink-0 pt-3">{bottomBtn}</div>
        </>
      )}
    </motion.div>
  )
}

function bottomLabel(q, isAnswered, graded, more) {
  if (q.fmt === SA && !graded) return '채점'
  if (!isAnswered) return '정답을 고르세요'
  return more ? '다음' : '결과 보기'
}

// 보기 버튼 색: 정답=초록, 내가 고른 오답=빨강, 나머지=흐리게.
// ring(박스 바깥)이 아니라 border-2(박스 안)로 그린다 — 가운데 스크롤 영역이 가로로
// 클리핑해 ring 좌·우가 잘리는 문제 방지. 항상 같은 두께(투명↔유색)라 정렬·폭 안 변함.
function optionClass(i, selected, answerIndex) {
  const base = 'rounded-2xl border-2 p-4 text-left transition-colors'
  if (selected === null) return `${base} border-transparent bg-card hover:border-line hover:bg-card-hover`
  if (i === answerIndex) return `${base} border-good/60 bg-good/15`
  if (i === selected) return `${base} border-bad/60 bg-bad/15`
  return `${base} border-transparent bg-card/50 opacity-60`
}

function saInputClass(graded, ok) {
  const base = 'w-full rounded-2xl border-2 bg-card p-4 text-base outline-none placeholder:text-muted'
  if (!graded) return `${base} border-transparent focus:border-accent`
  return ok ? `${base} border-good/60 bg-good/15` : `${base} border-bad/60 bg-bad/15`
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

// 급수 칩(여러 개라 줄바꿈). 선택된 것만 accent.
function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
      }`}
    >
      {children}
    </button>
  )
}

// 세그먼트 선택(개수·형식·방향). 선택된 칸만 accent.
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
