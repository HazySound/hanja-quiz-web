import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { loadHanja, loadExamples, buildDeck, hanjaByIds, readingText, exampleWords, chosungOf } from '../lib/hanja.js'
import { getGrade, getOnly } from '../lib/prefs.js'
import * as wordbook from '../lib/wordbook.js'
import * as schedule from '../lib/schedule.js'
import * as session from '../lib/session.js'
import * as progress from '../lib/progress.js'
import WordSheet from '../components/WordSheet.jsx'
import ScopeBuilder from '../components/ScopeBuilder.jsx'
import JumpSheet from '../components/JumpSheet.jsx'
import HanjaListSheet from '../components/HanjaListSheet.jsx'

// 플래시카드: 한자 보고 훈음 떠올리기. 탭하면 훈음 공개. 예시단어는 '한자어'만 표기(암기용)→탭하면 상세.
export default function Flashcards() {
  const nav = useNavigate()
  const location = useLocation()
  const preset = location.state?.scope // 내 목록 등에서 넘어온 범위(있으면 바로 카드)
  const scheduleMark = !!location.state?.scheduleMark // 스케줄에서 진입 → 넘긴 카드 자동 학습완료 기록
  const resume = !!location.state?.resume // 메인 '이어서 하기'로 진입
  const isFill = !!location.state?.fill // 개별 한자 '바로 채우기' — 세션 저장/복원 안 함
  const reviewKey = location.state?.reviewKey || null // 복습이면 진도 슬롯('all'|'date:...')
  const isReview = !!reviewKey
  const slot = isReview ? `rev:${reviewKey}:flash` : 'flash' // 복습은 키별 별도 슬롯(메인 이어하기엔 안 뜸)
  const saveOn = (scheduleMark || isReview) && !isFill // 위치 저장 여부(복습도 저장, 단 진도기록은 X)
  const [marking, setMarking] = useState(scheduleMark) // 진도 자동기록 여부(복원 시 세션 값 사용)
  const [all, setAll] = useState(null)
  const [phase, setPhase] = useState(preset || resume ? 'cards' : 'config')
  const [scope, setScope] = useState(preset || { kind: 'all', order: 'seen', count: null })
  const [baseDeck, setBaseDeck] = useState([]) // 원래 순서(셔플 끄면 복귀)
  const [deck, setDeck] = useState([])
  const [shuffleOn, setShuffleOn] = useState(false)
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [hideMode, setHideMode] = useState(false) // 훈음 가리기 모드
  const [sheetWord, setSheetWord] = useState(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [listHanja, setListHanja] = useState(null) // 한자 '목록에 담기' 시트
  const [, setFavVer] = useState(0)
  const [, setBookVer] = useState(0)
  const [, setExReady] = useState(false)

  useEffect(() => {
    loadHanja().then(setAll)
    loadExamples().then(() => setExReady(true))
  }, [])

  // 카드 진입 시 덱 준비 — 이어서 하기/스케줄이면 저장 세션 복원(덱·위치 그대로), 아니면 새 덱.
  useEffect(() => {
    if (!(all && phase === 'cards' && deck.length === 0)) return
    const sess = session.load(slot)
    const canResume = !isFill && sess?.deckIds?.length && (resume || isReview || (scheduleMark && sess.date === schedule.todayStr()))
    if (canResume) {
      setBaseDeck(hanjaByIds(all, sess.baseIds || sess.deckIds))
      setDeck(hanjaByIds(all, sess.deckIds))
      setShuffleOn(!!sess.shuffleOn)
      setI(Math.min(sess.index || 0, sess.deckIds.length - 1))
      setMarking(!!sess.scheduleMark)
    } else {
      const d = buildDeck(all, { grade: getGrade(), only: getOnly(), ...scope })
      setBaseDeck(d)
      setDeck(d)
      setI(0)
      if (scheduleMark) setMarking(true)
      if (saveOn) {
        const idsOnly = d.map((h) => h.id)
        session.save(slot, { kind: 'flash', baseIds: idsOnly, deckIds: idsOnly, index: 0, shuffleOn: false, scheduleMark, date: schedule.todayStr() })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, phase])

  function start() {
    const d = buildDeck(all, { grade: getGrade(), only: getOnly(), ...scope })
    setBaseDeck(d)
    setDeck(d)
    setShuffleOn(false)
    setI(0)
    setRevealed(false)
    setPhase('cards')
  }

  const card = deck[i]
  const showReading = !hideMode || revealed

  // 스케줄 학습: 카드를 펼쳐 볼 때마다 '암기' 자동 기록 + 위치 저장(이어서 하기용).
  useEffect(() => {
    if (!deck[i]) return
    if (marking) schedule.recordItem(deck[i].id, 'flash') // 진도 기록은 스케줄 학습만(복습은 X)
    if (saveOn) { const sess = session.load(slot); if (sess) session.save(slot, { ...sess, index: i }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, deck])

  function move(d) {
    if (!deck.length) return
    setI((p) => (p + d + deck.length) % deck.length)
    setRevealed(false)
  }
  // 셔플 토글: 켜면 랜덤, 끄면 원래 순서. 현재 표시 순서를 세션에도 저장(이어하기 시 그 순서 유지).
  function toggleShuffle() {
    const on = !shuffleOn
    const a = on
      ? (() => { const x = [...baseDeck]; for (let k = x.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [x[k], x[j]] = [x[j], x[k]] } return x })()
      : baseDeck
    setShuffleOn(on)
    setDeck(a)
    setI(0)
    setRevealed(false)
    if (saveOn) {
      const sess = session.load(slot)
      if (sess) session.save(slot, { ...sess, deckIds: a.map((h) => h.id), shuffleOn: on, index: 0 })
    }
  }

  // ----- 범위 설정 -----
  if (phase === 'config') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.18 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0">
          <button onClick={() => nav(-1)} className="mb-3 rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
            ◀ 뒤로
          </button>
          <h1 className="mb-1 text-2xl font-bold tracking-tight">플래시카드</h1>
          <p className="text-muted mb-4 text-sm">암기할 범위를 골라요. (급수는 메인에서)</p>
        </div>
        <div className="screen-scroll">
          {!all ? (
            <p className="text-muted text-sm">불러오는 중…</p>
          ) : (
            <ScopeBuilder all={all} grade={getGrade()} only={getOnly()} scope={scope} onChange={setScope} />
          )}
        </div>
        <div className="shrink-0 pt-3">
          <button
            onClick={start}
            disabled={!all}
            className="w-full rounded-2xl bg-accent py-4 font-bold text-white border border-accent/40 hover:opacity-90 disabled:opacity-50"
          >
            암기 시작
          </button>
        </div>
      </motion.div>
    )
  }

  // ----- 카드 -----
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.18 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* 헤더 */}
        <div className="shrink-0">
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => (scheduleMark || resume ? nav('/schedule') : location.state?.back ? nav('/schedule', { state: location.state.back }) : preset ? nav(-1) : setPhase('config'))}
              className="rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover"
            >
              ◀ {scheduleMark || resume ? '일일 학습' : location.state?.back ? '캘린더' : preset ? '뒤로' : '범위'}
            </button>
            <button onClick={() => nav('/')} className="rounded-xl bg-card px-3 py-2 text-sm hover:bg-card-hover" aria-label="메인">
              🏠
            </button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => {
                setHideMode((v) => !v)
                setRevealed(false)
              }}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
                hideMode ? 'bg-accent text-white' : 'bg-card text-muted'
              }`}
            >
              {hideMode ? '훈음 가림' : '훈음 보임'}
            </button>
            <button onClick={toggleShuffle} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${shuffleOn ? 'bg-accent text-white' : 'bg-card text-muted'}`}>
              🔀 셔플
            </button>
            {card && (
              <button
                onClick={() => setListHanja({ id: card.id, c: card.c, label: readingText(card) })}
                className={`text-xl leading-none ${progress.inAnyList(card.id) ? 'text-gold' : 'text-muted'}`}
                aria-label="목록에 담기"
              >
                {progress.inAnyList(card.id) ? '★' : '☆'}
              </button>
            )}
            <button onClick={() => setJumpOpen(true)} className="text-muted ml-auto rounded-xl bg-card px-3 py-1.5 text-sm">🔍 찾기</button>
          </div>
        </div>

        {/* 카드 + 예시 */}
        <div className="screen-scroll">
          {!card ? (
            <p className="text-muted text-sm">{all ? '대상 한자가 없어요.' : '불러오는 중…'}</p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  onClick={() => setRevealed((v) => !v)}
                  className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl bg-card py-8"
                >
                  <span className="brand-hanja text-8xl leading-none">{card.c}</span>
                  {showReading ? (
                    <span className="mt-5 text-xl font-semibold">{readingText(card)}</span>
                  ) : (
                    <span className="text-muted mt-5 text-sm">탭하여 훈·음 보기</span>
                  )}
                </button>

                <FlashExamples char={card.c} onPick={setSheetWord} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* 하단 네비 */}
        <div className="mt-3 flex shrink-0 items-center gap-3">
          <button
            onClick={() => move(-1)}
            className="flex-1 rounded-2xl bg-card py-3.5 font-bold hover:bg-card-hover"
          >
            ◀ 이전
          </button>
          <button onClick={() => setJumpOpen(true)} className="text-muted w-20 shrink-0 text-center text-sm underline-offset-2 hover:underline">
            {deck.length ? `${i + 1} / ${deck.length}` : '-'}
          </button>
          <button
            onClick={() => move(1)}
            className="flex-1 rounded-2xl bg-accent py-3.5 font-bold text-white hover:opacity-90"
          >
            다음 ▶
          </button>
        </div>
      </motion.div>

      <WordSheet word={sheetWord} onClose={() => { setSheetWord(null); setBookVer((v) => v + 1) }} />
      <JumpSheet
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        items={jumpOpen ? deck.map((h, idx) => ({ idx, label: h.c, sub: readingText(h), search: `${h.c} ${readingText(h)}`, chapter: chosungOf(h.r?.[0]?.[1] || ''), radical: h.rad, radCh: h.radc })) : []}
        onJump={(idx) => { setI(idx); setRevealed(false) }}
      />
      <HanjaListSheet hanja={listHanja} onClose={() => { setListHanja(null); setFavVer((v) => v + 1) }} />
    </>
  )
}

// 플래시카드 예시단어: '한자어'만 표기(읽기 숨김·암기용). 탭하면 상세 시트. 단어장에 있으면 금색.
function FlashExamples({ char, onPick }) {
  const words = exampleWords(char, 6)
  if (!words.length) return null
  return (
    <div className="mt-3 rounded-xl bg-card/60 p-3">
      <div className="text-muted mb-2 text-xs">예시 단어 · 탭하면 읽기·뜻·단어장</div>
      <div className="flex flex-wrap gap-2">
        {words.map((w, k) => (
          <button
            key={k}
            onClick={() => onPick(w)}
            className={`hanja rounded-lg px-2.5 py-1.5 text-base transition-colors ${
              wordbook.containsAny(w[0]) ? 'bg-gold/15 text-gold' : 'bg-card hover:bg-card-hover'
            }`}
          >
            {w[0]}
          </button>
        ))}
      </div>
    </div>
  )
}
