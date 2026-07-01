import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getFontScale, setFontScale, resetAllData } from '../lib/prefs.js'

// 글꼴 크기 — html 루트 폰트크기 배율. rem 기반이라 모든 화면이 같이 커짐. 미리보기는 실시간 반영.
const SIZES = [
  { v: 0.9, label: '작게' },
  { v: 1.0, label: '보통' },
  { v: 1.15, label: '크게' },
  { v: 1.3, label: '아주 크게' },
]

export default function Settings() {
  const nav = useNavigate()
  const [scale, setScale] = useState(getFontScale())
  const [confirming, setConfirming] = useState(false)

  const pick = (v) => {
    setScale(v)
    setFontScale(v) // 저장 + 즉시 적용(html 폰트크기)
  }
  const doReset = () => {
    resetAllData()
    window.location.href = '/' // 전체 새로고침 → 메모리 상태까지 초기화하고 메인으로
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
      className="screen-scroll flex flex-col"
    >
      <button onClick={() => nav('/')} className="mb-4 self-start rounded-xl bg-card px-4 py-2 text-sm hover:bg-card-hover">
        ◀ 뒤로
      </button>
      <h1 className="mb-5 text-2xl font-bold">설정</h1>

      <section>
        <div className="mb-2 font-bold">글꼴 크기</div>
        <div className="text-muted mb-3 text-sm">모든 화면의 글자 크기가 함께 바뀌어요.</div>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((s) => (
            <button
              key={s.v}
              onClick={() => pick(s.v)}
              className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
                scale === s.v ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 미리보기 — 루트 폰트크기가 바뀌면 이 영역도 실시간으로 같이 커짐 */}
        <div className="mt-4 rounded-2xl bg-card p-5">
          <div className="text-muted mb-2 text-xs">미리보기</div>
          <div className="flex items-center gap-4">
            <span className="brand-hanja text-6xl leading-none">漢</span>
            <div>
              <div className="text-lg font-bold">한수 한 · 한나라 한</div>
              <div className="text-muted mt-1 text-sm">예시 단어 · 漢字(한자), 漢文(한문)</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-line mt-8 border-t pt-6">
        <div className="text-bad mb-2 font-bold">데이터 초기화</div>
        <div className="text-muted mb-3 text-sm leading-relaxed">
          이 기기에 저장된 <b>모든 학습 데이터</b>를 지워요 — 급수·글꼴 설정, 한자 진도·오답·즐겨찾기·내 목록, 단어장, 학습 계획, 이어하기.
          <span className="text-bad"> 되돌릴 수 없어요.</span>
        </div>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="border-bad/50 bg-bad/10 text-bad hover:bg-bad/20 rounded-xl border px-4 py-2.5 text-sm font-bold"
          >
            모든 데이터 초기화
          </button>
        ) : (
          <div className="border-bad/50 bg-bad/10 rounded-xl border p-4">
            <div className="text-bad mb-3 text-sm font-bold">정말 모두 지울까요? 되돌릴 수 없어요.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-card px-4 py-2.5 text-sm font-bold hover:bg-card-hover">
                취소
              </button>
              <button onClick={doReset} className="bg-bad flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">
                정말 초기화
              </button>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  )
}
