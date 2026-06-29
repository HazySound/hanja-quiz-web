import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

// 메인(가장 자주 누르는) 동작 하나를 큰 카드로 띄워 위계를 준다.
const PRIMARY = {
  icon: '🎲',
  title: '랜덤 풀이',
  desc: '덜 풀어본 한자부터 무작위로',
  to: '/quiz',
}

// 나머지는 조용한 2열 그리드. 순서가 아니므로 번호는 붙이지 않는다.
const CARDS = [
  { icon: '🧩', title: '자유 출제', desc: '부수·획수로 골라서', to: '/builder' },
  { icon: '📖', title: '챕터별 풀이', desc: '음가 ㄱ~ㅎ 순서로', to: '/chapters' },
  { icon: '🃏', title: '플래시카드', desc: '넘기며 암기', to: '/flashcards' },
  { icon: '📒', title: '단어장', desc: '모은 단어로 복습', to: '/wordbook' },
  { icon: '📚', title: '내 목록', desc: '오답·즐겨찾기·커스텀', to: '/lists' },
  { icon: '⚙️', title: '설정', desc: '글꼴·테마', to: '/settings' },
]

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
    <motion.div variants={container} initial="hidden" animate="show" className="min-h-0 flex-1 overflow-y-auto">
      {/* 히어로 */}
      <motion.header variants={item} className="mb-7 mt-1 flex items-center gap-4">
        <PracticeMark />
        <div>
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight">한자 퀴즈</h1>
          <span className="mt-1.5 block h-[3px] w-7 rounded-full bg-gold" />
          <p className="mt-2 text-sm text-muted">한자와 단어를, 매일 조금씩.</p>
        </div>
      </motion.header>

      {/* 메인 동작 */}
      <motion.button
        variants={item}
        onClick={() => nav(PRIMARY.to)}
        whileTap={{ scale: 0.98 }}
        className="group relative mb-3 flex w-full items-center gap-4 overflow-hidden rounded-2xl
                   bg-gradient-to-br from-accent/20 to-card p-5 text-left ring-1 ring-accent/30
                   transition-shadow hover:ring-accent/60"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/25 text-2xl">
          {PRIMARY.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold">{PRIMARY.title}</span>
          <span className="mt-0.5 block text-sm text-muted">{PRIMARY.desc}</span>
        </span>
        <span className="shrink-0 text-xl text-accent transition-transform group-hover:translate-x-0.5">
          ›
        </span>
      </motion.button>

      {/* 나머지 메뉴 — 폰=1열, 작은 화면 이상=2열 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <motion.button
            key={c.to}
            variants={item}
            onClick={() => nav(c.to)}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3.5 rounded-2xl bg-card p-4 text-left
                       ring-1 ring-line/0 transition-colors hover:bg-card-hover hover:ring-line
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
  )
}
