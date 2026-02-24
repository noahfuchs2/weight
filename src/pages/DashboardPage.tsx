import { useAppStore, ORDERED_SLOTS } from '@/stores/appStore'
import { useDailyLog } from '@/hooks/useDailyLog'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { DailyProgress } from '@/components/dashboard/DailyProgress'
import { MealSlotCard } from '@/components/dashboard/MealSlotCard'
import { QuickAddDialog } from '@/components/dashboard/QuickAddDialog'
import { GoalSettingsDialog } from '@/components/dashboard/GoalSettingsDialog'

export function DashboardPage() {
    const selectedDate = useAppStore((s) => s.selectedDate)
    const { entries, dayTotals } = useDailyLog(selectedDate)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Dein tägliches Tracking auf einen Blick</p>
                </div>
                <div className="flex items-center gap-3">
                    <GoalSettingsDialog />
                    <DateNavigator />
                    <QuickAddDialog selectedDate={selectedDate} />
                </div>
            </div>

            {/* Progress Overview */}
            <DailyProgress totals={dayTotals} />

            {/* Macro Summary Bar */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Kalorien', value: dayTotals.kcal, unit: 'kcal', color: 'text-primary' },
                    { label: 'Protein', value: dayTotals.protein, unit: 'g', color: 'text-chart-3' },
                    { label: 'Kohlenhydrate', value: dayTotals.carbs, unit: 'g', color: 'text-chart-5' },
                    { label: 'Fett', value: dayTotals.fat, unit: 'g', color: 'text-chart-4' },
                ].map((macro) => (
                    <div key={macro.label} className="glass rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">{macro.label}</p>
                        <p className={`text-xl font-bold ${macro.color}`}>
                            {typeof macro.value === 'number' && macro.value % 1 !== 0 ? macro.value.toFixed(1) : macro.value}
                            <span className="text-sm font-normal text-muted-foreground ml-0.5">{macro.unit}</span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Meal Slots */}
            <div className="space-y-4">
                {ORDERED_SLOTS.map((slotId) => {
                    const slotEntries = entries.filter((e) => e.slotId === slotId)
                    return <MealSlotCard key={slotId} slotId={slotId} entries={slotEntries} />
                })}
            </div>
        </div>
    )
}
