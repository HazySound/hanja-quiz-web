import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const CARDS = [
  { icon: '🎲', title: '랜덤 풀이', desc: '무작위 한자 문제', to: '/quiz' },
  { icon: '🧩', title: '자유 출제', desc: '부수·획수로 골라 출제', to: '/builder' },
  { icon: '📖', title: '챕터별 풀이', desc: '음가 ㄱ~ㅎ', to: '/chapters' },
  { icon: '🃏', title: '플래시카드', desc: '암기용 카드', to: '/flashcards' },
  { icon: '📚', title: '내 목록', desc: '오답·즐겨찾기·커스텀', to: '/lists' },
  { icon: '📒', title: '단어장', desc: '단어 모아 암기·문제', to: '/wordbook' },
  { icon: '⚙️', title: '설정', desc: '글꼴·테마', to: '/settings' },
]

export default function Menu() {
  const nav = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <header className="mb-5 mt-1">
        <h1 className="text-3xl font-bold tracking-tight">한자 퀴즈</h1>
        <p className="text-muted text-sm mt-1">한자·단어를 풀고 단어장으로 복습하세요</p>
      </header>

      {/* 폰=1열, 작은 화면 이상=2열로 자동 재배치 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <motion.button
            key={c.to}
            onClick={() => nav(c.to)}
            whileTap={{ scale: 0.97 }}
            className="text-left rounded-2xl bg-card hover:bg-card-hover
                       active:bg-card-hover transition-colors p-5 min-h-[88px]
                       flex flex-col justify-center"
          >
            <div className="text-xl font-bold flex items-center gap-2">
              <span>{c.icon}</span>
              <span>{c.title}</span>
            </div>
            <div className="text-muted text-sm mt-1">{c.desc}</div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
