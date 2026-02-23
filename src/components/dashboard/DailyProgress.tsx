import { useAppStore } from '@/stores/appStore'
import type { Nutrition } from '@/db/schemas'

interface DailyProgressProps {
    totals: Nutrition
}

export function DailyProgress({ totals }: DailyProgressProps) {
    const { dailyGoals } = useAppStore()
    const kcalPct = Math.min(100, (totals.kcal / dailyGoals.kcal) * 100)
    const proteinPct = Math.min(100, (totals.protein / dailyGoals.protein) * 100)

    return (
        <div className="grid grid-cols-2 gap-6">
            {/* Kcal Ring */}
            <div className="glass rounded-2xl p-6 flex items-center gap-6 glow-primary">
                <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(0.25 0 0)" strokeWidth="10" />
                        <circle
                            cx="60" cy="60" r="50" fill="none"
                            stroke="url(#kcalGrad)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${kcalPct * 3.14} 314`}
                            className="transition-all duration-700 ease-out"
                        />
                        <defs>
                            <linearGradient id="kcalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="oklch(0.72 0.19 155)" />
                                <stop offset="100%" stopColor="oklch(0.65 0.2 250)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{totals.kcal.toLocaleString('de-DE')}</span>
                        <span className="text-xs text-muted-foreground">kcal</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Kalorien</h3>
                    <p className="text-3xl font-bold">
                        {totals.kcal.toLocaleString('de-DE')}
                        <span className="text-lg text-muted-foreground font-normal"> / {dailyGoals.kcal.toLocaleString('de-DE')}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {Math.max(0, dailyGoals.kcal - totals.kcal).toLocaleString('de-DE')} verbleibend
                    </p>
                    <div className="w-full bg-muted rounded-full h-2 mt-3">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-700 ease-out"
                            style={{ width: `${kcalPct}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Protein Ring */}
            <div className="glass rounded-2xl p-6 flex items-center gap-6">
                <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(0.25 0 0)" strokeWidth="10" />
                        <circle
                            cx="60" cy="60" r="50" fill="none"
                            stroke="url(#protGrad)"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={`${proteinPct * 3.14} 314`}
                            className="transition-all duration-700 ease-out"
                        />
                        <defs>
                            <linearGradient id="protGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="oklch(0.7 0.18 50)" />
                                <stop offset="100%" stopColor="oklch(0.65 0.18 330)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{totals.protein.toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">g</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Protein</h3>
                    <p className="text-3xl font-bold">
                        {totals.protein.toFixed(0)}
                        <span className="text-lg text-muted-foreground font-normal">g / {dailyGoals.protein}g</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {Math.max(0, dailyGoals.protein - totals.protein).toFixed(0)}g verbleibend
                    </p>
                    <div className="w-full bg-muted rounded-full h-2 mt-3">
                        <div
                            className="h-2 rounded-full bg-gradient-to-r from-chart-3 to-chart-4 transition-all duration-700 ease-out"
                            style={{ width: `${proteinPct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
