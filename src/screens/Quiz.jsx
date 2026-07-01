import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  loadHanja,
  loadExamples,
  buildSession,
  resolveScope,
  gradeSA,
  readingFor,
  readingText,
  exampleWords,
  MC,
  SA,
  WORD,
  H2R,
  R2H,
} from '../lib/hanja.js'
import { record, statsOf, inAnyList } from '../lib/progress.js'
import * as wordbook from '../lib/wordbook.js'
import * as schedule from '../lib/schedule.js'
import * as session from '../lib/session.js'
import { getGrade, getOnly, getQuickCfg, setQuickCfg } from '../lib/prefs.js'
import WordSheet from '../components/WordSheet.jsx'
import HanjaSheet from '../components/HanjaSheet.jsx'
import HanjaListSheet from '../components/HanjaListSheet.jsx'
import ScopeBuilder from '../components/ScopeBuilder.jsx'

const FORMATS = [
  { key: MC, label: '객관식' },
  { key: SA, label: '단답식' },
  { key: WORD, label: '단어' },
]
const DIRS = [
  { key: 'mix', label: '섞기' },
  { key: H2R, label: '한자→훈음' },
  { key: R2H, label: '훈음→한자' },
]

export default function Quiz() {
  const nav = useNavigate()
  const location = useLocation()
  const initial = location.state?.initial || null // 챕터에서 왔으면 음가 초성 프리셋
  const presetScope = location.state?.scope || null // 내 목록 등에서 넘어온 고정 범위(목록)
  const presetTitle = location.state?.title || null
  const scheduleMark = !!location.state?.scheduleMark // 스케줄에서 진입 → 푼 한자 자동 학습완료 기록
  const isFill = !!location.state?.fill // 개별 한자 '바로 채우기' — 세션 저장/복원 안 함
  const reviewKey = location.state?.reviewKey || null // 복습이면 진도 슬롯('all'|'date:...')
  const isReview = !!reviewKey
  const slot = isReview ? `rev:${reviewKey}:quiz` : 'quiz'
  const saveOn = (scheduleMark || isReview) && !isFill // 세션 저장(복습도 저장, 진도기록은 X)
  const wantResume = !isFill && (!!location.state?.resume || scheduleMark || isReview)
  const launchedMode = location.state?.mode || 'quiz' // 'quiz'(문제) | 'word'(단어) | 'wrong'(오답)
  // 이어서 하기: 저장된 세션이 미완이면 그 자리에서 복원(한 번만 계산).
  // 메인 '이어서'(resume)는 무조건 / 오늘학습 재진입(scheduleMark)은 같은 날·같은 모드만.
  const restoredRef = useRef(undefined)
  if (restoredRef.current === undefined) {
    const rs = wantResume ? session.load(slot) : null
    const fresh = rs && (location.state?.resume || isReview || (rs.date === schedule.todayStr() && (rs.mode || 'quiz') === launchedMode))
    restoredRef.current = fresh && rs.questions?.length && rs.qi < rs.questions.length ? rs : null
  }
  const restored = restoredRef.current
  const free = !presetScope && !initial // 빠른 학습(자유) — 한 페이지에 범위+형식+방향, 설정은 localStorage에 기억
  const savedQuick = free ? getQuickCfg() : null
  const screenTitle = presetTitle || (initial ? `챕터 ${initial}` : !presetScope ? '빠른 학습' : '문제 풀기')
  const fromSub = !!(initial || presetScope) // 챕터·목록에서 진입(뒤로=메인 아님) → 홈버튼 노출
  const noWord = !!location.state?.noWord // 단어가 별도 버튼인 맥락(스케줄·복습 문제) → 형식에서 단어 제외
  const fmtOptions = noWord ? FORMATS.filter((f) => f.key !== WORD) : FORMATS
  // 뒤로: state.back 있으면 그 화면(예: 캘린더+선택날짜)으로, 아니면 직전으로.
  const backOut = () => (location.state?.back ? nav('/schedule', { state: location.state.back }) : nav(-1))
  const [all, setAll] = useState(null)
  const [error, setError] = useState(null)

  // phase: 'config' | 'play' | 'done'
  const [phase, setPhase] = useState(restored ? 'play' : 'config')
  const [fmt, setFmt] = useState(restored ? restored.fmt : savedQuick?.fmt ?? location.state?.fmt ?? MC)
  const [dir, setDir] = useState(restored ? restored.dir : savedQuick?.dir ?? 'mix')
  const [marking, setMarking] = useState(restored ? !!restored.scheduleMark : scheduleMark)
  const grade = getGrade() // 전역 출제 범위(메인에서 설정)
  const only = getOnly()
  // 범위(빌더). 프리셋(목록) > 챕터 > 전체. 설정은 화면 state로만 유지(풀이↔설정 복원, 메인 나가면 초기화).
  const [scope, setScope] = useState(() =>
    presetScope
      ? presetScope
      : initial
        ? { kind: 'chapter', initials: [initial], order: 'seen', count: 20 }
        : savedQuick?.scope || { kind: 'all', order: 'seen', count: 20 },
  )

  // 빠른 학습 설정 기억(범위·형식·방향).
  useEffect(() => {
    if (free) setQuickCfg({ scope, fmt, dir })
  }, [free, scope, fmt, dir])

  const [questions, setQuestions] = useState(restored ? restored.questions : [])
  const [qi, setQi] = useState(restored ? restored.qi : 0)
  const [results, setResults] = useState(restored ? restored.results || [] : []) // [{ q, correct }]

  // 객관식: 고른 보기 index. 단답식: 입력칸 값들 + 채점 여부/칸별 정오.
  const [selected, setSelected] = useState(null)
  const [inputs, setInputs] = useState([])
  const [graded, setGraded] = useState(false)
  const [saPer, setSaPer] = useState(null)

  const [sheetWord, setSheetWord] = useState(null) // 단어 상세 바텀시트
  const [sheetChar, setSheetChar] = useState(null) // 한자 상세 바텀시트(채점 후 사전)
  const [listHanja, setListHanja] = useState(null) // 한자 '목록에 담기' 시트
  const [exReady, setExReady] = useState(false) // 예시 데이터 로드됨
  const [bookVer, setBookVer] = useState(0) // 단어장 변경 시 칩 금색 갱신용
  const [, setFavVer] = useState(0) // 즐겨찾기 ★ 갱신용

  useEffect(() => {
    loadHanja().then(setAll).catch((e) => setError(e.message))
    loadExamples().then(() => setExReady(true)) // 정답 공개 예시단어용(백그라운드)
  }, [])

  async function start() {
    if (fmt === WORD) await loadExamples() // 단어형은 예시 데이터 필요
    const qs = buildSession(all, { scope: { grade, only, ...scope }, dir, fmt })
    setQuestions(qs)
    setResults([])
    setQi(0)
    resetAnswer()
    setPhase('play')
    if (scheduleMark) setMarking(true)
    if (saveOn) {
      session.save(slot, { kind: 'quiz', questions: qs, qi: 0, results: [], fmt, dir, mode: launchedMode, scheduleMark, date: schedule.todayStr() })
    }
  }

  // 진행 위치·결과를 세션에 저장(이어서 하기용). 스케줄 학습 또는 복습(채우기 제외).
  useEffect(() => {
    if (!(marking || isReview) || phase !== 'play' || isFill) return
    const sess = session.load(slot)
    if (sess) session.save(slot, { ...sess, qi, results })
  }, [qi, results, marking, phase])


  function resetAnswer() {
    setSelected(null)
    setInputs([])
    setGraded(false)
    setSaPer(null)
  }

  const q = questions[qi]
  const more = qi + 1 < questions.length
  const isInput = q?.fmt === SA || q?.fmt === WORD // 입력형(단답식·단어형)
  const isAnswered = isInput ? graded : selected !== null

  // 객관식: 보기 탭 = 즉시 채점.
  function pick(i) {
    if (selected !== null) return
    const correct = i === q.answerIndex
    record(q.hanjaId, correct)
    if (marking) schedule.recordItem(q.hanjaId, 'quiz') // 객관식=문제 항목
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
    if (q.fmt === WORD) {
      // 단어형: 한자 오답노트와 무관(구성 한자를 개별 오답으로 넣지 않음). 단어 단위로만 기록.
      const [hj, rd, mean] = q.word
      wordbook.recordWord(hj, rd, mean || '', allOk)
    } else {
      record(q.hanjaId, allOk) // 한자: 출제/정답/오답노트 기록
    }
    if (marking) schedule.recordItem(q.hanjaId, q.fmt === WORD ? 'word' : 'quiz')
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
      if (saveOn) session.clear(slot) // 끝까지 풀면 이어서 세션 정리
    }
  }

  function onBottom() {
    if (isInput && !graded) submitSA()
    else if (isAnswered) next()
  }

  // ----- 로딩 / 에러 -----
  if (error) {
    return (
      <Shell onBack={() => nav(-1)} onHome={fromSub ? () => nav('/') : null} title={screenTitle}>
        <p className="text-bad text-sm">{error}</p>
      </Shell>
    )
  }
  if (!all) {
    return (
      <Shell onBack={() => nav(-1)} onHome={fromSub ? () => nav('/') : null} title={screenTitle}>
        <p className="text-muted text-sm">한자 데이터를 불러오는 중…</p>
      </Shell>
    )
  }

  // ----- 설정 -----
  if (phase === 'config') {
    return (
      <Shell onBack={backOut} onHome={fromSub ? () => nav('/') : null} title={screenTitle}>
        {presetScope ? (
          <div className="text-muted mb-2 text-sm">
            출제 대상{' '}
            <span className="text-gold font-semibold">
              {resolveScope(all, { grade, only, ...scope }).length}자
            </span>{' '}
            {presetTitle && <span>({presetTitle})</span>}
          </div>
        ) : (
          <ScopeBuilder all={all} grade={grade} only={only} scope={scope} onChange={setScope} />
        )}

        <div className="mt-5 flex flex-col gap-4">
          <Field label="형식">
            <Segmented options={fmtOptions} value={fmt} onChange={setFmt} />
          </Field>
          {fmt === MC && (
            <Field label="출제 방향">
              <Segmented options={DIRS} value={dir} onChange={setDir} />
            </Field>
          )}
        </div>

        {free ? (
          <div className="mt-5 flex gap-2">
            <button onClick={() => nav('/flashcards', { state: { scope } })} className="flex-1 rounded-2xl bg-card py-4 text-base font-bold hover:bg-card-hover">🃏 암기</button>
            <motion.button whileTap={{ scale: 0.98 }} onClick={start} className="flex-1 rounded-2xl bg-accent py-4 text-base font-bold text-white border border-accent/40 hover:opacity-90">📝 문제</motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={start}
            className="mt-5 w-full rounded-2xl bg-accent py-4 text-base font-bold text-white
                       border border-accent/40 transition-opacity hover:opacity-90"
          >
            문제 시작
          </motion.button>
        )}
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
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-card p-6 text-center border border-accent/30">
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
              {wrong.map(({ q: wq }, i) => {
                const isR2H = wq.fmt === MC && wq.dir === R2H
                const hanjaText = isR2H ? wq.options[wq.answerIndex] : wq.prompt
                const readingText =
                  wq.fmt === MC
                    ? wq.dir === H2R
                      ? wq.options[wq.answerIndex]
                      : wq.prompt
                    : wq.answers.join(' / ')
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-card p-3">
                    <span className="hanja text-3xl">{hanjaText}</span>
                    <span className="text-muted text-sm">{readingText}</span>
                  </div>
                )
              })}
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

  // 출제할 문제가 없을 때(예: 단어형인데 예시 단어가 없는 범위).
  if (phase === 'play' && !questions.length) {
    return (
      <Shell onBack={() => (scheduleMark || location.state?.resume ? nav('/schedule') : setPhase('config'))} onHome={fromSub ? () => nav('/') : null} title={screenTitle}>
        <p className="text-muted text-sm">출제할 문제가 없어요. (단어 예시가 없는 범위일 수 있어요)</p>
      </Shell>
    )
  }

  // ----- 풀이 -----
  const isHanjaOption = q.fmt === MC && q.dir === R2H // 보기가 한자 글자인지
  const stat = q.fmt === WORD ? wordbook.wordStats(q.word[0]) : statsOf(q.hanjaId) // 이 문제 출제/정답 횟수
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
    <>
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      // 객관식은 키보드가 없어 항상 스크롤 허용(넘칠 때만 스크롤 — 큰 폰트서 보기·버튼 잘림 방지).
      // 입력형(단답·단어)은 채점 후에만 허용(입력 중 키보드 빈공간 방지 — 기존 처리 유지).
      className={`flex flex-col ${isAnswered || q.fmt === MC ? 'screen-scroll' : ''}`}
    >
      {/* 헤더: 뒤로 + 진행 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => (scheduleMark || location.state?.resume ? nav('/schedule') : setPhase('config'))}
            className="rounded-xl bg-card px-3.5 py-2 text-sm hover:bg-card-hover"
          >
            ◀ {scheduleMark || location.state?.resume ? '일일 학습' : '설정'}
          </button>
          <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">
            🏠
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setListHanja({ id: q.hanjaId, c: q.char, label: readingText(all.find((h) => h.id === q.hanjaId) || { r: [] }) })}
            className={`text-xl leading-none ${inAnyList(q.hanjaId) ? 'text-gold' : 'text-muted'}`}
            aria-label="목록에 담기"
          >
            {inAnyList(q.hanjaId) ? '★' : '☆'}
          </button>
          <span className="text-sm text-muted">정답 {results.filter((r) => r.correct).length}</span>
        </div>
      </div>
      <div className="mb-1 flex items-center justify-between text-sm text-muted">
        <span>
          {qi + 1} / {questions.length}
        </span>
        <span>
          출제 {stat.seen}회 · 정답 {stat.correct}회
        </span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-card">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${(qi / questions.length) * 100}%` }}
        />
      </div>

      {/* 문제 + 보기/입력 + 버튼 (자연 높이 흐름). */}
      <AnimatePresence mode="wait">
        <motion.div
          key={qi}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          {/* 문제. 입력형(단답식·단어형)은 키보드 위에 폼이 들어가도록 카드를 컴팩트하게. */}
          <div className={`rounded-2xl bg-card text-center ${isInput ? 'py-4' : 'py-7'}`}>
            <div className={promptClass(q)}>{q.prompt}</div>
            <div className="text-muted mt-2 text-sm">{q.sub}</div>
          </div>

          {/* 객관식 보기 */}
          {q.fmt === MC && (
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
          )}

          {/* 입력형(단답식·단어형) 입력 */}
          {isInput && (
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
                    placeholder={inputPlaceholder(q, i)}
                    autoComplete="off"
                    autoCapitalize="off"
                    className={saInputClass(graded, saPer?.[i])}
                  />
                  {graded && <div className="text-muted mt-1 px-1 text-sm">정답: {ans}</div>}
                </div>
              ))}
              {/* 단어형: 채점 후 단어 속 한자 풀이 + 뜻 */}
              {graded && q.fmt === WORD && <WordReveal word={q.word} />}
            </div>
          )}

          {/* 정답 공개 후: 이 한자의 예시 단어(탭하면 뜻·단어장). 단어형은 제외(이미 풀이+뜻이 나옴). */}
          {isAnswered && q.fmt !== WORD && (
            <ExampleWords char={q.char} onPick={setSheetWord} ver={bookVer} ready={exReady} />
          )}

          {/* 정답 공개 후: 한자 사전 — 정답+보기 한자 버튼(탭하면 상세 시트). */}
          {isAnswered && q.fmt !== WORD && <DictRow chars={dictChars(q)} onPick={setSheetChar} />}

          {/* 채점/다음 */}
          {bottomBtn}
        </motion.div>
      </AnimatePresence>
    </motion.div>
      <HanjaSheet char={sheetChar} all={all} onClose={() => setSheetChar(null)} onStar={setListHanja} onPickWord={setSheetWord} />
      <WordSheet
        word={sheetWord}
        onClose={() => {
          setSheetWord(null)
          setBookVer((v) => v + 1)
        }}
      />
      <HanjaListSheet hanja={listHanja} onClose={() => { setListHanja(null); setFavVer((v) => v + 1) }} />
    </>
  )
}

function bottomLabel(q, isAnswered, graded, more) {
  if ((q.fmt === SA || q.fmt === WORD) && !graded) return '채점'
  if (!isAnswered) return '정답을 고르세요'
  return more ? '다음' : '결과 보기'
}

// 채점 후 사전 버튼에 쓸 한자들: 객관식=정답+보기 한자(중복 제거), 단답식=메인 한자.
function dictChars(q) {
  if (q.fmt === MC) {
    const opts = q.dir === R2H ? q.options : q.notes // r2h=보기가 한자, h2r=notes가 한자
    const seen = new Set()
    const out = []
    for (const c of [q.char, ...(opts || [])]) {
      if (c && !seen.has(c)) { seen.add(c); out.push(c) }
    }
    return out
  }
  return [q.char]
}

// 채점 후 한자 사전 버튼 행 — 탭하면 한자 상세 시트.
function DictRow({ chars, onPick }) {
  if (!chars.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card/60 p-3">
      <span className="text-muted text-xs">📖 사전</span>
      {chars.map((c) => (
        <button key={c} onClick={() => onPick(c)} className="brand-hanja rounded-lg bg-card px-3 py-1.5 text-xl hover:bg-card-hover">
          {c}
        </button>
      ))}
    </div>
  )
}

// 문제 카드 글자 스타일. 단어형=한자어(.hanja, 길이별 크기), 단답식/객관식h2r=명조 한자, r2h=훈음 텍스트.
function promptClass(q) {
  if (q.fmt === WORD) return `hanja leading-none ${q.prompt.length >= 3 ? 'text-5xl' : 'text-6xl'}`
  if (q.fmt === SA) return 'brand-hanja text-5xl leading-none'
  if (q.dir === H2R) return 'brand-hanja text-7xl leading-none'
  return 'text-3xl font-bold'
}

function inputPlaceholder(q, i) {
  if (q.fmt === WORD) return '읽기 (예: 가두)'
  return q.answers.length > 1 ? `훈·음 ${i + 1}` : '훈·음 (예: 아름다울 가)'
}

// 단어형 정답 공개: 단어 속 각 한자의 훈음 풀이(頭腦 → 頭(머리 두) , 腦(골 뇌)) + 뜻.
function WordReveal({ word }) {
  const [hj, rd, mean] = word
  const seen = new Set()
  const parts = []
  for (let i = 0; i < hj.length; i++) {
    const c = hj[i]
    if (seen.has(c)) continue
    seen.add(c)
    parts.push(`${c}(${readingFor(c, rd[i] || '')})`)
  }
  return (
    <div className="mt-1 rounded-xl bg-card/60 p-3">
      <div className="text-sm">
        <span className="text-muted">풀이  </span>
        <span className="hanja">{parts.join('   ,   ')}</span>
      </div>
      {mean && <div className="text-muted mt-1.5 text-xs leading-relaxed">{mean}</div>}
    </div>
  )
}

// 정답 공개 후 예시 단어 칩들 — 탭하면 상세 시트(뜻·단어장). 단어장에 담긴 단어는 금색.
function ExampleWords({ char, onPick }) {
  const words = exampleWords(char)
  if (!words.length) return null
  return (
    <div className="rounded-xl bg-card/60 p-3">
      <div className="text-muted mb-2 text-xs">예시 단어 · 탭하면 뜻·단어장</div>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => (
          <button
            key={i}
            onClick={() => onPick(w)}
            className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              wordbook.containsAny(w[0]) ? 'bg-gold/15 text-gold' : 'bg-card hover:bg-card-hover'
            }`}
          >
            <span className="hanja">{w[0]}</span>
            <span className="text-muted">({w[1]})</span>
          </button>
        ))}
      </div>
    </div>
  )
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

// 공통 화면 틀: 헤더(뒤로+제목)는 고정, 본문만 내부 스크롤(긴 설정·결과 대응).
function Shell({ onBack, onHome, title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={onBack} className="rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
            ◀ 뒤로
          </button>
          {onHome && (
            <button onClick={onHome} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">
              🏠
            </button>
          )}
        </div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="screen-scroll">{children}</div>
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
