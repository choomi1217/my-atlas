import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TimelineItem {
  label: string
  description: string
  period: string
  start: number
  end: number
  type: 'education' | 'work' | 'certification'
  anchor?: string
  externalUrl?: string
}

const ITEMS: TimelineItem[] = [
  { label: '대전보건대학교 컴퓨터정보과', description: '컴퓨터정보과 (4.05 / 4.5)', period: '2017.02 — 2021.02', start: 2017 + 2/12, end: 2021 + 2/12, type: 'education' },
  { label: '빅데이터 분석가 양성과정', description: 'HIT 빅데이터 분석가 양성과정 수료', period: '2019.09 — 2019.10', start: 2019 + 9/12, end: 2019 + 11/12, type: 'education' },
  { label: 'DBian SQL 튜닝', description: '친절한 SQL 튜닝 과정 수료', period: '2020.01 — 2020.02', start: 2020 + 1/12, end: 2020 + 2/12, type: 'education' },
  { label: '도로명주소단', description: 'Java 백엔드 개발자 · GIS 기반 도로명주소 웹 애플리케이션', period: '2020.12 — 2023.03', start: 2020 + 12/12, end: 2023 + 3/12, type: 'work', anchor: 'exp-doromyeong' },
  { label: '정보처리기사', description: '국가공인 자격증 취득', period: '2021.11', start: 2021 + 11/12, end: 2021 + 11/12, type: 'certification' },
  { label: 'SQLD', description: 'SQL 개발자 자격증 취득', period: '2021.12', start: 2021 + 12/12, end: 2021 + 12/12, type: 'certification' },
  { label: 'AWS Terraform', description: 'AWS 기초와 Terraform으로 Provision하기 수료', period: '2023.05', start: 2023 + 5/12, end: 2023 + 5/12, type: 'education' },
  { label: 'TDD Clean Code Java', description: 'NextStep TDD, Clean Code with Java 17기 수료', period: '2023.10 — 2023.12', start: 2023 + 10/12, end: 2023 + 12/12, type: 'education' },
  { label: 'NFLUX', description: 'Java 백엔드 개발자 · 부산교통공사 지하철 관리 시스템', period: '2024.01 — 2024.10', start: 2024 + 1/12, end: 2024 + 10/12, type: 'work', anchor: 'exp-nflux' },
  { label: 'Studio XID Korea', description: 'Test Engineer · ProtoPie Cloud QA, User Testing QA', period: '2025.03 — 2026.03.09', start: 2025 + 3/12, end: 2026 + 3/12, type: 'work', anchor: 'exp-studio-xid' },
  { label: 'my-atlas', description: 'Side Project · QA 지식 관리 & AI 테스트 자동화 웹 애플리케이션', period: '2026.02 — 현재', start: 2026 + 2/12, end: 2026 + 5/12, type: 'work', externalUrl: 'https://github.com/choomi1217/my-atlas' },
]

const YEAR_START = 2017
const YEAR_END = 2027
const TOTAL = YEAR_END - YEAR_START

const TYPE_CONFIG = {
  education:     { color: 'bg-violet-200', border: 'border-violet-300', label: 'Education' },
  work:          { color: 'bg-violet-500', border: 'border-violet-600', label: 'Work' },
  certification: { color: 'bg-gray-300',   border: 'border-gray-400',   label: 'Certification' },
} as const

function pct(val: number) {
  return ((val - YEAR_START) / TOTAL) * 100
}

interface TooltipData {
  item: TimelineItem
  x: number
  y: number
}

function Tooltip({ data }: { data: TooltipData }) {
  return createPortal(
    <div
      className="fixed z-[9999] bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none"
      style={{ left: data.x, top: data.y - 8, transform: 'translate(0, -100%)' }}
    >
      <div className="font-semibold">{data.item.label}</div>
      <div className="text-gray-300">{data.item.description}</div>
      <div className="text-gray-400 font-mono mt-0.5">{data.item.period}</div>
    </div>,
    document.body,
  )
}

interface CareerTimelineProps {
  onNavigate?: (anchorId: string) => void
}

export default function CareerTimeline({ onNavigate }: CareerTimelineProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const years = Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, i) => YEAR_START + i)

  const handleMouseEnter = (i: number, item: TimelineItem) => {
    const el = barRefs.current[i]
    if (!el) return
    const rect = el.getBoundingClientRect()
    setTooltip({ item, x: rect.left, y: rect.top })
  }

  const handleClick = (item: TimelineItem) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer')
    } else if (item.anchor && onNavigate) {
      onNavigate(item.anchor)
    }
  }

  // hide tooltip on scroll
  useEffect(() => {
    const hide = () => setTooltip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2 text-xs text-gray-500">
            {key === 'certification' ? (
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.color}`} />
            ) : (
              <span className={`w-5 h-2.5 rounded-sm ${cfg.color}`} />
            )}
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-6 overflow-x-auto">
        {/* Year axis */}
        <div className="relative h-6 mb-2 min-w-[600px]">
          {years.map(y => (
            <span
              key={y}
              className="absolute font-mono text-[11px] text-gray-400 -translate-x-1/2"
              style={{ left: `${pct(y)}%` }}
            >
              {y}
            </span>
          ))}
        </div>

        {/* Grid lines + bars */}
        <div className="relative min-w-[600px]">
          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {years.map(y => (
              <div
                key={y}
                className="absolute top-0 bottom-0 w-px bg-violet-100"
                style={{ left: `${pct(y)}%` }}
              />
            ))}
          </div>

          {/* Rows */}
          {ITEMS.map((item, i) => {
            const cfg = TYPE_CONFIG[item.type]
            const left = pct(item.start)
            const isCert = item.type === 'certification'
            const isDot = isCert || (item.end - item.start < 0.1)
            const width = isDot ? 0 : pct(item.end) - left
            const isHovered = tooltip?.item === item
            const isClickable = !!(item.anchor || item.externalUrl)

            return (
              <div
                key={i}
                className="relative h-8 flex items-center"
                onMouseEnter={() => handleMouseEnter(i, item)}
                onMouseLeave={() => setTooltip(null)}
              >
                {isDot ? (
                  <div
                    ref={el => { barRefs.current[i] = el }}
                    className={`absolute w-3 h-3 rounded-full ${cfg.color} border ${cfg.border} -translate-x-1/2 z-10 transition-transform ${isHovered ? 'scale-150' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
                    style={{ left: `${left}%` }}
                    onClick={() => handleClick(item)}
                  />
                ) : (
                  <div
                    ref={el => { barRefs.current[i] = el }}
                    className={`absolute h-5 rounded ${cfg.color} border ${cfg.border} z-10 transition-opacity ${isHovered ? 'opacity-80' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
                    style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                    onClick={() => handleClick(item)}
                  />
                )}
                {/* Label */}
                <span
                  className={`absolute text-[11px] font-medium text-gray-600 whitespace-nowrap z-20 pointer-events-none ${isClickable ? 'underline decoration-dotted underline-offset-2' : ''}`}
                  style={{
                    left: isDot ? `${left + 1.5}%` : `${left + width + 0.8}%`,
                  }}
                >
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Portal tooltip */}
      {tooltip && <Tooltip data={tooltip} />}
    </div>
  )
}
