import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { loadHanja, gradeOptions } from '../lib/hanja.js'
import { getGrade, getOnly, gradeLabel } from '../lib/prefs.js'
import * as schedule from '../lib/schedule.js'
import * as session from '../lib/session.js'
import GradeSheet from '../components/GradeSheet.jsx'

// 메뉴 그리드. 랜덤/자유출제/챕터/플래시카드는 '빠른 학습' 하나로 통합.
const CARDS = [
  { icon: '⚡', title: '빠른 학습', desc: '범위 골라 암기·문제', to: '/quiz' },
  { icon: '📒', title: '단어장', desc: '모은 단어로 복습', to: '/wordbook' },
  { icon: '📚', title: '내 목록', desc: '오답·즐겨찾기·커스텀', to: '/lists' },
  { icon: '⚙️', title: '설정', desc: '글꼴·테마', to: '/settings' },
]

// 이어서 하기 행 — 탭하면 진행하던 세션으로, ✕로 지움.
function ResumeRow({ icon, label, onGo, onClear }) {
  return (
    <div className="border-gold/40 bg-gold/10 flex items-center gap-2 rounded-2xl border px-4 py-3">
      <button onClick={onGo} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="text-lg">{icon}</span>
        <span className="text-gold min-w-0 truncate font-bold">▶ {label}</span>
      </button>
      <button onClick={onClear} className="text-muted shrink-0 px-1 text-base" aria-label="이어서 지우기">✕</button>
    </div>
  )
}

// 한자 연습칸(米字格) — 학습의 실제 도구를 로고 마크로 가져온 시그니처 요소.
function PracticeMark() {
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <rect
          x="2.5" y="2.5" width="95" height="95" rx="10"
          fill="none" stroke="var(--color-line)" strokeWidth="2"
        />
        <g stroke="var(--color-accent)" strokeWidth="1.5"
           strokeDasharray="2 5" strokeLinecap="round" opacity="0.55">
          <line x1="50" y1="6" x2="50" y2="94" />
          <line x1="6" y1="50" x2="94" y2="50" />
          <line x1="12" y1="12" x2="88" y2="88" />
          <line x1="88" y1="12" x2="12" y2="88" />
        </g>
      </svg>
      <span className="brand-hanja absolute inset-0 grid place-items-center text-[2.1rem] leading-none text-white">
        漢
      </span>
      {/* 낙관 도장 — 시그니처 한 방 */}
      <span
        className="brand-hanja absolute -right-2 -top-2 grid h-7 w-7 -rotate-6 place-items-center
                   rounded-[7px] bg-seal text-[0.8rem] text-white shadow-md ring-1 ring-white/25"
      >
        學
      </span>
    </div>
  )
}

export default function Menu() {
  const nav = useNavigate()
  const reduce = useReducedMotion()

  const [filterOpen, setFilterOpen] = useState(false)
  const [grade, setGrade] = useState(getGrade())
  const [only, setOnly] = useState(getOnly())
  const [all, setAll] = useState(null)
  useEffect(() => {
    loadHanja().then(setAll) // 급수 옵션·라벨·글자수 표시용
  }, [])

  // 학습 스케줄(있으면 오늘 남은 분량 표시). 메뉴 진입마다 새로 읽음.
  const sch = schedule.load()
  const plan = sch ? schedule.buildPlan(sch, schedule.todayStr()) : null
  // 진행 중 세션(이어서 하기) — 마지막에 하던 것 하나만. ✕로 숨겨도 진행내역은 보존.
  const [, setVer] = useState(0)
  const lastSess = session.latest()
  let resumeShow = false, resumeLabel = '', resumeIcon = '📝', resumeGo = '/quiz'
  if (lastSess && !lastSess.dismissed) {
    if (lastSess.kind === 'flash') {
      resumeShow = !!lastSess.deckIds?.length
      resumeLabel = `암기 이어서 · ${(lastSess.index || 0) + 1}/${lastSess.deckIds?.length || 0}`
      resumeIcon = '🃏'; resumeGo = '/flashcards'
    } else if (lastSess.kind === 'word') {
      const wm = lastSess.wmode || 'read'
      const c = lastSess[wm] || {}
      resumeShow = !!c.ids?.length
      resumeLabel = `단어(${wm === 'quiz' ? '문제' : '읽기'}) 이어서 · ${(c.index || 0) + 1}/${c.ids?.length || 0}`
      resumeIcon = '🔤'; resumeGo = '/word-daily'
    } else {
      resumeShow = !!lastSess.questions?.length
      resumeLabel = `${lastSess.mode === 'wrong' ? '오답' : '문제'} 이어서 · ${(lastSess.qi || 0) + 1}/${lastSess.questions?.length || 0}`
      resumeIcon = '📝'; resumeGo = '/quiz'
    }
  }

  // 화면 진입: 헤더 → 카드들이 살짝 시차를 두고 떠오른다(reduce 모드면 즉시).
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.045, delayChildren: 0.04 } },
  }
  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <>
    <motion.div variants={container} initial="hidden" animate="show" className="screen-scroll">
      {/* 히어로 */}
      <motion.header variants={item} className="mb-5 mt-1 flex items-center gap-4">
        <PracticeMark />
        <div>
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight">한자 퀴즈</h1>
          <span className="mt-1.5 block h-[3px] w-7 rounded-full bg-gold" />
          <p className="mt-2 text-sm text-muted">한자와 단어를, 매일 조금씩.</p>
        </div>
      </motion.header>

      {/* 출제 범위(급수) — 전역. 모든 풀이·플래시카드에 적용. */}
      <motion.button
        variants={item}
        onClick={() => setFilterOpen(true)}
        whileTap={{ scale: 0.99 }}
        className="mb-3 flex w-full items-center gap-2 rounded-2xl bg-card px-4 py-3 text-left
                   border border-line/0 transition-colors hover:bg-card-hover hover:border-line"
      >
        <span className="text-base">🎚️</span>
        <span className="text-muted text-sm">출제 범위</span>
        <span className="ml-1 font-bold">{gradeLabel(grade, only, gradeOptions())}</span>
        <span className="text-muted ml-auto text-sm">바꾸기 ›</span>
      </motion.button>

      {/* 이어서 하기 — 마지막에 하던 세션 하나만. ✕는 숨김만(진행내역 보존). */}
      {resumeShow && (
        <motion.div variants={item} className="mb-3">
          <ResumeRow
            icon={resumeIcon}
            label={resumeLabel}
            onGo={() => nav(resumeGo, { state: { resume: true } })}
            onClear={() => { session.dismiss(lastSess.kind); setVer((v) => v + 1) }}
          />
        </motion.div>
      )}

      {/* 오늘 학습(스케줄) — 메인 동작 큰 카드 */}
      <motion.button
        variants={item}
        onClick={() => nav('/schedule')}
        whileTap={{ scale: 0.98 }}
        className="group mb-3 flex w-full items-center gap-4 overflow-hidden rounded-2xl
                   bg-gradient-to-br from-gold/15 to-card p-5 text-left border border-gold/30
                   transition-shadow hover:border-gold/50"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold/20 text-2xl">🎯</span>
        <span className="min-w-0 flex-1">
          {plan ? (
            <>
              <span className="block text-lg font-bold">일일 학습</span>
              <span className="mt-0.5 block text-sm text-muted">
                {plan.dueIds.length > 0 ? `${plan.dueIds.length}자 남음` : '오늘 분량 완료!'}
                {plan.overdue.length > 0 && <span className="text-bad"> · 밀림 {plan.overdue.length}</span>}
              </span>
            </>
          ) : (
            <>
              <span className="block text-lg font-bold">학습 계획 만들기</span>
              <span className="mt-0.5 block text-sm text-muted">시험 대비, 매일 자동 분배</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-xl text-gold transition-transform group-hover:translate-x-0.5">›</span>
      </motion.button>

      {/* 메뉴 그리드 — 폰=1열, 작은 화면 이상=2열 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plan && (
          <motion.button
            variants={item}
            onClick={() => nav('/schedule', { state: { view: 'calendar' } })}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left border border-line/0 transition-colors hover:bg-card-hover hover:border-line active:bg-card-hover"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">📅</span>
            <span className="min-w-0">
              <span className="block font-bold">캘린더</span>
              <span className="mt-0.5 block truncate text-sm text-muted">전체 일정·복습</span>
            </span>
          </motion.button>
        )}
        {CARDS.map((c) => (
          <motion.button
            key={c.to}
            variants={item}
            onClick={() => nav(c.to)}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left
                       border border-line/0 transition-colors hover:bg-card-hover hover:border-line
                       active:bg-card-hover"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">
              {c.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{c.title}</span>
              <span className="mt-0.5 block truncate text-sm text-muted">{c.desc}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
      <GradeSheet
        open={filterOpen}
        all={all}
        grade={grade}
        only={only}
        onClose={() => setFilterOpen(false)}
        onChange={(g, o) => {
          setGrade(g)
          setOnly(o)
        }}
      />
    </>
  )
}
