import { useMemo } from 'react'
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
import type { WeightGoal, WeightEntry } from '@/db/schemas'

interface WeightChartProps {
    goal: WeightGoal
    entries: WeightEntry[]
}

export function WeightChart({ goal, entries }: WeightChartProps) {
    const chartData = useMemo(() => {
        const startDate = parseISO(goal.startDate)
        const goalDate = parseISO(goal.goalDate)
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

        const totalChartDays = differenceInDays(endDate, startDate)

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

    if (chartData.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                Ungültiger Zeitraum – das Zieldatum muss nach dem Startdatum liegen.
            </div>
        )
    }

    // Calculate tick interval so we don't show too many labels
    const tickInterval = Math.max(1, Math.floor(chartData.length / 12))

    return (
        <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Gewichtsverlauf</h3>
            <ResponsiveContainer width="100%" height={380}>
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
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval={tickInterval}
                    />
                    <YAxis
                        domain={[minW, maxW]}
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
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
                        dot={{ fill: 'oklch(0.7 0.18 50)', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: 'oklch(0.7 0.18 50)', stroke: 'oklch(0.18 0 0)', strokeWidth: 2 }}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
