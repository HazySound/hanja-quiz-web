import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { loadHanja, chapters } from '../lib/hanja.js'
import { getGrade, getOnly } from '../lib/prefs.js'

// 챕터별 풀이: 음가(첫 소리) 초성 ㄱ~ㅎ로 범위를 좁혀 푼다.
// 챕터를 고르면 랜덤 풀이 화면(/quiz)에 initial을 넘겨 그 범위로 출제.
export default function Chapters() {
  const nav = useNavigate()
  const [all, setAll] = useState(null)
  useEffect(() => {
    loadHanja().then(setAll)
  }, [])

  const list = all ? chapters(all, getGrade(), getOnly()) : []
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0">
        <button
          onClick={() => nav(-1)}
          className="mb-4 rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover"
        >
          ◀ 뒤로
        </button>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">챕터별 풀이</h1>
        <p className="text-muted mb-4 text-sm">음가(첫 소리) 순서로 골라 풀어요.</p>
      </div>
      <div className="screen-scroll">
        {!all ? (
          <p className="text-muted text-sm">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {list.map((c) => (
              <motion.button
                key={c.initial}
                whileTap={{ scale: 0.96 }}
                onClick={() => nav('/quiz', { state: { initial: c.initial } })}
                className="flex flex-col items-center rounded-2xl bg-card py-5 transition-colors hover:bg-card-hover"
              >
                <span className="text-3xl font-bold">{c.initial}</span>
                <span className="text-muted mt-1 text-xs">{c.count}자</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
