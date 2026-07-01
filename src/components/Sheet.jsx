import { motion, AnimatePresence } from 'framer-motion'

// 공용 바텀시트 + 행 버튼 + 선택 체크표시. 단어장/내 목록에서 함께 사용.
export function Sheet({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] rounded-t-3xl bg-card px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <h3 className="mb-3 text-lg font-bold">{title}</h3>
            {children}
            <button onClick={onClose} className="mt-4 w-full rounded-2xl bg-card-hover py-3 font-bold">닫기</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function Row({ onClick, accent, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-left font-semibold transition-colors ${accent ? 'text-accent bg-card-hover hover:bg-card' : 'bg-card-hover hover:bg-card'}`}
    >
      {children}
    </button>
  )
}

export function CheckDot({ on }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-xs ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>
      {on ? '✓' : ''}
    </span>
  )
}
