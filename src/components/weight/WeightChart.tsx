import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
import type { WeightGoal, WeightEntry } from '@/db/schemas'

interface WeightChartProps {
    goal: WeightGoal
    entries: WeightEntry[]
}

const MIN_HEIGHT = 200
const MAX_HEIGHT = 800
const DEFAULT_HEIGHT = 380
const HEIGHT_STEP = 40

const MIN_WIDTH = 100
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 100
const WIDTH_STEP = 50

export function WeightChart({ goal, entries }: WeightChartProps) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [chartHeight, setChartHeight] = useState(DEFAULT_HEIGHT)
    const [chartWidth, setChartWidth] = useState(DEFAULT_WIDTH)
    const overlayRef = useRef<HTMLDivElement>(null)

    const chartData = useMemo(() => {
        const startDate = parseISO(goal.startDate)
        const goalDate = parseISO(goal.goalDate)

        // Validate parsed dates
        if (isNaN(startDate.getTime()) || isNaN(goalDate.getTime())) return []

        const totalDays = differenceInDays(goalDate, startDate)
        if (totalDays <= 0) return []

        const weightDiff = goal.goalWeight - goal.startWeight

        // Build a map of actual entries by date
        const entryMap = new Map<string, number>()
        for (const e of entries) {
            entryMap.set(e.date, e.weight)
        }

        // Find the latest date we need to show (either goalDate or today, whichever is later for context)
        const today = new Date()
        const endDate = goalDate > today ? goalDate : today

        let totalChartDays = differenceInDays(endDate, startDate)

        // Safety cap: prevent runaway loops from corrupted date data (max 2 years)
        if (totalChartDays > 730) totalChartDays = 730

        const data: { date: string; label: string; target: number | null; actual: number | null }[] = []

        for (let i = 0; i <= totalChartDays; i++) {
            const currentDate = addDays(startDate, i)
            const dateStr = format(currentDate, 'yyyy-MM-dd')
            const label = format(currentDate, 'dd. MMM', { locale: de })

            // Target line: linear from start to goal (only within goal range)
            let target: number | null = null
            if (i <= totalDays) {
                target = Math.round((goal.startWeight + (weightDiff * i) / totalDays) * 10) / 10
            }

            // Actual: only if we have an entry
            const actual = entryMap.get(dateStr) ?? null

            data.push({ date: dateStr, label, target, actual })
        }

        return data
    }, [goal, entries])

    // Dynamic Y-axis bounds
    const allWeights = [
        goal.startWeight,
        goal.goalWeight,
        ...entries.map((e) => e.weight),
    ]
    const minW = Math.floor(Math.min(...allWeights) - 2)
    const maxW = Math.ceil(Math.max(...allWeights) + 2)

    // Today reference line
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Escape key + body scroll lock for fullscreen
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsFullscreen(false)
    }, [])

    useEffect(() => {
        if (isFullscreen) {
            document.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [isFullscreen, handleKeyDown])

    // Click outside to close fullscreen
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) setIsFullscreen(false)
    }

    if (chartData.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                Ungültiger Zeitraum – das Zieldatum muss nach dem Startdatum liegen.
            </div>
        )
    }

    // Calculate tick interval so we don't show too many labels
    const effectiveHeight = isFullscreen ? window.innerHeight - 140 : chartHeight
    const tickInterval = Math.max(1, Math.floor(chartData.length / (isFullscreen ? 20 : 12)))

    const chartContent = (
        <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
            <div style={{ minWidth: `${chartWidth}%`, height: effectiveHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="targetGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="oklch(0.72 0.19 155)" />
                                <stop offset="100%" stopColor="oklch(0.65 0.2 250)" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: 'oklch(0.65 0 0)', fontSize: isFullscreen ? 12 : 11 }}
                            tickLine={false}
                            axisLine={false}
                            interval={tickInterval}
                        />
                        <YAxis
                            domain={[minW, maxW]}
                            tick={{ fill: 'oklch(0.65 0 0)', fontSize: isFullscreen ? 12 : 11 }}
                            tickLine={false}
                            axisLine={false}
                            unit=" kg"
                        />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'oklch(0.18 0 0 / 0.9)',
                        border: '1px solid oklch(0.3 0 0)',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                    }}
                    labelStyle={{ color: 'oklch(0.65 0 0)', fontSize: 12 }}
                    itemStyle={{ fontSize: 13 }}
                    formatter={(value: number | undefined) => [`${value ?? '–'} kg`]}
                />
                <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />

                {/* Today marker */}
                {chartData.some((d) => d.date === todayStr) && (
                    <ReferenceLine
                        x={format(new Date(), 'dd. MMM', { locale: de })}
                        stroke="oklch(0.65 0 0)"
                        strokeDasharray="4 4"
                        label={{ value: 'Heute', fill: 'oklch(0.65 0 0)', fontSize: 11, position: 'top' }}
                    />
                )}

                {/* Target line (linear) */}
                <Line
                    type="linear"
                    dataKey="target"
                    name="Ziel"
                    stroke="url(#targetGrad)"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    dot={false}
                    connectNulls
                />

                        {/* Actual weight line */}
                        <Line
                            type="monotone"
                            dataKey="actual"
                            name="Tatsächlich"
                            stroke="oklch(0.7 0.18 50)"
                            strokeWidth={2.5}
                            dot={{ fill: 'oklch(0.7 0.18 50)', r: isFullscreen ? 5 : 4, strokeWidth: 0 }}
                            activeDot={{ r: isFullscreen ? 8 : 6, fill: 'oklch(0.7 0.18 50)', stroke: 'oklch(0.18 0 0)', strokeWidth: 2 }}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )

    const heightControls = (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Höhe</span>
            <button
                onClick={() => setChartHeight(h => Math.max(MIN_HEIGHT, h - HEIGHT_STEP))}
                disabled={chartHeight <= MIN_HEIGHT}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Höhe verringern"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <input
                type="range"
                min={MIN_HEIGHT}
                max={MAX_HEIGHT}
                step={HEIGHT_STEP}
                value={chartHeight}
                onChange={(e) => setChartHeight(Number(e.target.value))}
                className="weight-chart-slider w-20"
                title={`Höhe: ${chartHeight}px`}
            />
            <button
                onClick={() => setChartHeight(h => Math.min(MAX_HEIGHT, h + HEIGHT_STEP))}
                disabled={chartHeight >= MAX_HEIGHT}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Höhe erhöhen"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{chartHeight}px</span>
        </div>
    )

    const widthControls = (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Breite</span>
            <button
                onClick={() => setChartWidth(w => Math.max(MIN_WIDTH, w - WIDTH_STEP))}
                disabled={chartWidth <= MIN_WIDTH}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Breite verringern"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <input
                type="range"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={WIDTH_STEP}
                value={chartWidth}
                onChange={(e) => setChartWidth(Number(e.target.value))}
                className="weight-chart-slider w-20"
                title={`Breite: ${chartWidth}%`}
            />
            <button
                onClick={() => setChartWidth(w => Math.max(MAX_WIDTH, w + WIDTH_STEP))}
                disabled={chartWidth >= MAX_WIDTH}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Breite erhöhen"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{chartWidth}%</span>
        </div>
    )

    return (
        <>
            {/* Normal inline chart */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Gewichtsverlauf</h3>
                    <div className="flex flex-wrap items-center gap-4 justify-end">
                        <div className="hidden sm:flex items-center gap-4 bg-background/50 rounded-lg px-3 py-1.5 border border-border/50">
                            {widthControls}
                            <div className="w-[1px] h-6 bg-border/50"></div>
                            {heightControls}
                        </div>
                        <button
                            onClick={() => setIsFullscreen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                            title="Vollbild"
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                            Vollbild
                        </button>
                    </div>
                </div>
                {chartContent}
            </div>

            {/* Fullscreen overlay */}
            {isFullscreen && (
                <div
                    ref={overlayRef}
                    onClick={handleOverlayClick}
                    className="weight-chart-fullscreen-overlay"
                >
                    <div className="weight-chart-fullscreen-content">
                        {/* Fullscreen header */}
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h2 className="text-lg font-semibold gradient-text">Gewichtsverlauf</h2>
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex items-center gap-4 bg-background/50 rounded-lg px-3 py-1.5 border border-border/50">
                                    {widthControls}
                                </div>
                                <button
                                    onClick={() => setIsFullscreen(false)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all"
                                    title="Vollbild verlassen (Esc)"
                                >
                                    <Minimize2 className="h-4 w-4" />
                                    Schließen
                                </button>
                            </div>
                        </div>
                        {chartContent}
                    </div>
                </div>
            )}
        </>
    )
}
