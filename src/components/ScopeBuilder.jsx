import { useState } from 'react'
import { chapters, radicalsList, strokeRange, resolveScope } from '../lib/hanja.js'

// 공용 범위 빌더: 전체/챕터/부수/획수 + 순서 + 개수. 결과 scope를 onChange로 올린다.
// 급수(grade/only)는 전역(prefs)이라 밖에서 주입. DESIGN.md의 Scope 모델 참고.
const KINDS = [
  { k: 'all', label: '전체' },
  { k: 'chapter', label: '챕터(음가)' },
  { k: 'radical', label: '부수' },
  { k: 'strokes', label: '획수' },
]
const ORDERS = [
  { k: 'seen', label: '덜 본 것' },
  { k: 'seq', label: '가나다' },
  { k: 'random', label: '랜덤' },
]
const COUNTS = [null, 10, 20, 30, 50, 100]

export default function ScopeBuilder({ all, grade, only, scope, onChange }) {
  const set = (patch) => onChange({ ...scope, ...patch })
  // 개수 직접입력은 자체 텍스트 상태로(프리셋 강조와 분리). 그래야 50→500처럼 프리셋을 지나도 계속 타이핑됨.
  const [countText, setCountText] = useState(scope.count && !COUNTS.includes(scope.count) ? String(scope.count) : '')
  // 배열 필드 토글(다중 선택): initials/radicals
  const toggle = (field, k) => {
    const s = new Set(scope[field] || [])
    if (s.has(k)) s.delete(k)
    else s.add(k)
    set({ [field]: [...s] })
  }
  const kind = scope.kind || 'all'
  const resolved = all ? resolveScope(all, { grade, only, ...scope }) : []
  // 검색어·정렬도 scope에 저장 → 풀이 갔다 와도 유지(로컬 state면 리셋됨).
  const radQuery = scope.radQuery || ''
  const radSort = scope.radSort || 'num' // num(사전순) | name(가나다) | count(많은순)
  const setRadQuery = (v) => set({ radQuery: v })
  const setRadSort = (v) => set({ radSort: v })

  let rads = []
  if (kind === 'radical' && all) {
    rads = radicalsList(all, grade, only)
    const q = radQuery.trim()
    if (q) rads = rads.filter((r) => r.char === q || r.label.includes(q))
    if (radSort === 'name') rads = [...rads].sort((a, b) => a.label.localeCompare(b.label, 'ko'))
    else if (radSort === 'count') rads = [...rads].sort((a, b) => b.count - a.count)
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="범위">
        <Wrap>
          {KINDS.map((x) => (
            <Chip
              key={x.k}
              active={kind === x.k}
              onClick={() => set({ kind: x.k, initials: [], radicals: [], strokesMin: null, strokesMax: null })}
            >
              {x.label}
            </Chip>
          ))}
        </Wrap>
      </Field>

      {kind === 'chapter' && (
        <Field label="음가 챕터">
          <PickerGrid
            cols="grid-cols-3 sm:grid-cols-4"
            items={chapters(all, grade, only).map((c) => ({ key: c.initial, glyph: c.initial, count: c.count }))}
            selectedKeys={scope.initials || []}
            onToggle={(k) => toggle('initials', k)}
          />
        </Field>
      )}

      {kind === 'radical' && (
        <Field label="부수">
          <input
            value={radQuery}
            onChange={(e) => setRadQuery(e.target.value)}
            placeholder="부수 이름·글자 검색 (예: 사람, 人)"
            autoComplete="off"
            className="mb-2 w-full rounded-xl border-2 border-transparent bg-card p-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="mb-2 flex gap-2">
            <Chip active={radSort === 'num'} onClick={() => setRadSort('num')}>
              사전순
            </Chip>
            <Chip active={radSort === 'name'} onClick={() => setRadSort('name')}>
              가나다
            </Chip>
            <Chip active={radSort === 'count'} onClick={() => setRadSort('count')}>
              많은순
            </Chip>
          </div>
          <PickerGrid
            cols="grid-cols-2 sm:grid-cols-3"
            items={rads.map((r) => ({ key: r.num, glyph: r.char, label: r.label, count: r.count, hanja: true }))}
            selectedKeys={scope.radicals || []}
            onToggle={(k) => toggle('radicals', k)}
          />
        </Field>
      )}

      {kind === 'strokes' && (
        <Field label="획수 범위">
          <StrokePicker
            bounds={strokeRange(all, grade, only)}
            min={scope.strokesMin}
            max={scope.strokesMax}
            onChange={(mn, mx) => set({ strokesMin: mn, strokesMax: mx })}
          />
        </Field>
      )}

      <Field label="순서">
        <Wrap>
          {ORDERS.map((o) => (
            <Chip key={o.k} active={(scope.order || 'seen') === o.k} onClick={() => set({ order: o.k })}>
              {o.label}
            </Chip>
          ))}
        </Wrap>
      </Field>

      <Field label="개수">
        <Wrap>
          {COUNTS.map((c) => (
            <Chip key={c ?? 'all'} active={(scope.count ?? null) === c} onClick={() => { set({ count: c }); setCountText('') }}>
              {c ?? '전체'}
            </Chip>
          ))}
        </Wrap>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="직접 입력"
          value={countText}
          onChange={(e) => {
            const t = e.target.value
            setCountText(t)
            const v = parseInt(t, 10)
            set({ count: Number.isFinite(v) && v > 0 ? v : null })
          }}
          className="mt-2 w-32 rounded-xl border-2 border-transparent bg-card p-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
      </Field>

      <div className="text-muted text-sm">
        이 범위 <span className="text-gold font-semibold">{resolved.length}자</span>
      </div>
    </div>
  )
}

function StrokePicker({ bounds, min, max, onChange }) {
  const [lo, hi] = bounds
  const mn = min ?? lo
  const mx = max ?? hi
  return (
    <div className="flex items-center gap-2 text-sm">
      <Stepper value={mn} lo={lo} hi={mx} onChange={(v) => onChange(v, mx)} />
      <span className="text-muted">획 ~</span>
      <Stepper value={mx} lo={mn} hi={hi} onChange={(v) => onChange(mn, v)} />
      <span className="text-muted">획</span>
    </div>
  )
}
function Stepper({ value, lo, hi, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(Math.max(lo, value - 1))} className="h-8 w-8 rounded-lg bg-card text-lg">
        −
      </button>
      <span className="w-7 text-center font-semibold">{value}</span>
      <button onClick={() => onChange(Math.min(hi, value + 1))} className="h-8 w-8 rounded-lg bg-card text-lg">
        ＋
      </button>
    </div>
  )
}

// 부수/챕터 picker — 카드 그리드(한 줄에 여러 개), 다중 선택. 카드 안에 글자+이름+글자수.
function PickerGrid({ items, selectedKeys, onToggle, cols }) {
  const sset = new Set(selectedKeys || [])
  return (
    <div className={`screen-scroll grid max-h-[52vh] gap-2 pr-0.5 ${cols}`}>
      {items.map((it) => {
        const sel = sset.has(it.key)
        return (
          <button
            key={it.key}
            onClick={() => onToggle(it.key)}
            className={`flex flex-col items-center rounded-xl px-2 py-2.5 transition-colors ${
              sel ? 'bg-accent text-white' : 'bg-card hover:bg-card-hover'
            }`}
          >
            <span className={`text-2xl leading-none ${it.hanja ? 'hanja' : 'font-bold'}`}>{it.glyph}</span>
            {it.label && (
              <span className={`mt-1 text-center text-xs leading-tight ${sel ? 'text-white/90' : ''}`}>
                {it.label}
              </span>
            )}
            <span className={`mt-0.5 text-[11px] ${sel ? 'text-white/70' : 'text-muted'}`}>{it.count}자</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-muted mb-2 text-sm">{label}</div>
      {children}
    </div>
  )
}
function Wrap({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}
function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-card-hover'
      }`}
    >
      {children}
    </button>
  )
}
