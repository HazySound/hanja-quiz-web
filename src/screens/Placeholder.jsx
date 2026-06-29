import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

// 화면 전환·뒤로가기 동작과 반응형을 확인하기 위한 임시 화면.
// 이후 실제 기능(퀴즈/단어장 등)으로 하나씩 채워나간다.
export default function Placeholder({ title }) {
  const nav = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <button
        onClick={() => nav(-1)}
        className="self-start mb-4 rounded-xl bg-card hover:bg-card-hover
                   px-4 py-2 text-sm"
      >
        ◀ 뒤로
      </button>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted text-sm">아직 준비 중인 화면이에요. 곧 채워집니다.</p>

      <div className="hanja text-center text-7xl font-bold mt-10">漢字</div>
    </motion.div>
  )
}
