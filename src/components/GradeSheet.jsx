import { motion, AnimatePresence } from 'framer-motion'
import { gradeOptions, filterPool } from '../lib/hanja.js'
import { setGradePref, gradeLabel } from '../lib/prefs.js'

// 출제 범위(급수) 선택 바텀시트. 전역(prefs)에 저장하고 onChange로 부모에 알림.
export default function GradeSheet({ open, all, grade, only, onClose, onChange }) {
  function pick(g, o) {
    setGradePref(g, o)
    onChange(g, o)
  }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] rounded-t-3xl bg-card px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="mb-1 text-base font-bold">출제 범위 (급수)</div>
            <p className="text-muted mb-4 text-xs">모든 풀이·플래시카드에 공통으로 적용돼요.</p>

            <div className="flex flex-wrap gap-2">
              <Chip active={grade === null} count={all ? all.length : null} onClick={() => pick(null, false)}>
                전체
              </Chip>
              {gradeOptions().map((o) => (
                <Chip
                  key={o.grade}
                  active={grade === o.grade}
                  count={all ? filterPool(all, { grade: o.grade, only }).length : null}
                  onClick={() => pick(o.grade, only)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>

            {grade !== null && (
              <>
                <div className="text-muted mb-2 mt-5 text-sm">범위</div>
                <div className="flex gap-2">
                  <Seg active={!only} onClick={() => pick(grade, false)}>
                    누적
                  </Seg>
                  <Seg active={only} onClick={() => pick(grade, true)}>
                    배정한자만
                  </Seg>
                </div>
              </>
            )}

            <div className="text-muted mt-5 text-sm">
              선택 범위{' '}
              <span className="text-gold font-semibold">{gradeLabel(grade, only, gradeOptions())}</span>
              {all && (
                <>
                  {' · '}
                  <span className="text-gold font-semibold">{filterPool(all, { grade, only }).length}자</span>
                </>
              )}
            </div>

            <button
              onClick={onClose}
              className="bg-accent mt-5 w-full rounded-2xl py-3.5 font-bold text-white hover:opacity-90"
            >
              완료
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Chip({ active, count, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl px-3 py-1.5 transition-colors ${
        active ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
      }`}
    >
      <span className="text-sm font-semibold">{children}</span>
      {count != null && <span className="text-xs opacity-70">{count}자</span>}
    </button>
  )
}

function Seg({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
      }`}
    >
      {children}
    </button>
  )
}
