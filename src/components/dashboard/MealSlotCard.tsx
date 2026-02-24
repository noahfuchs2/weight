import { useState } from 'react'
import { Trash2, Pencil, Check, X, UtensilsCrossed, Carrot, Utensils } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { SLOT_LABELS, type SlotId, getSlotTargets } from '@/db/schemas'
import { useAppStore } from '@/stores/appStore'
import type { ResolvedLogEntry } from '@/hooks/useDailyLog'
import { db } from '@/db/database'

interface MealSlotCardProps {
    slotId: SlotId
    entries: ResolvedLogEntry[]
}

export function MealSlotCard({ slotId, entries }: MealSlotCardProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const { dailyGoals } = useAppStore()
    const target = getSlotTargets(dailyGoals.kcal, dailyGoals.protein)[slotId]

    const slotTotals = entries.reduce(
        (acc, e) => ({
            kcal: acc.kcal + e.totalNutrition.kcal,
            protein: acc.protein + e.totalNutrition.protein,
        }),
        { kcal: 0, protein: 0 }
    )


    const handleDelete = async (id: string) => {
        await db.logEntries.delete(id)
    }

    const handleStartEdit = (entry: ResolvedLogEntry) => {
        setEditingId(entry.id)
        setEditValue(
            entry.itemType === 'food'
                ? String(entry.amountGrams ?? 100)
                : String(entry.servings ?? 1)
        )
    }

    const handleSaveEdit = async (entry: ResolvedLogEntry) => {
        const num = parseFloat(editValue)
        if (isNaN(num) || num <= 0) return
        if (entry.itemType === 'food') {
            await db.logEntries.update(entry.id, { amountGrams: num })
        } else {
            await db.logEntries.update(entry.id, { servings: num })
        }
        setEditingId(null)
    }

    return (
        <Card className="group hover:border-primary/30 transition-colors duration-300">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-primary" />
                        {SLOT_LABELS[slotId]}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{slotTotals.kcal} / {target.kcal} kcal</span>
                        <span>{slotTotals.protein.toFixed(0)} / {target.protein}g P</span>
                    </div>
                </div>
                <div className="flex gap-2 mt-2">
                    <Progress
                        value={slotTotals.kcal}
                        max={target.kcal}
                        className="h-1.5 flex-1"
                        indicatorClassName="bg-gradient-to-r from-primary to-chart-2"
                    />
                    <Progress
                        value={slotTotals.protein}
                        max={target.protein}
                        className="h-1.5 w-20"
                        indicatorClassName="bg-gradient-to-r from-chart-3 to-chart-4"
                    />
                </div>
            </CardHeader>

            <CardContent>
                {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">Noch nichts geloggt</p>
                ) : (
                    <div className="space-y-2">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group/item"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Badge
                                        variant={entry.itemType === 'food' ? 'outline' : 'secondary'}
                                        className={`text-[10px] shrink-0 gap-1 flex items-center ${entry.itemType === 'food' ? 'border-orange-500/30 bg-orange-500/10' : 'bg-primary/20 text-primary-foreground'}`}
                                    >
                                        {entry.itemType === 'food' ? (
                                            <><Carrot className="h-3 w-3 text-orange-500" /> Zutat</>
                                        ) : (
                                            <><Utensils className="h-3 w-3 text-primary" /> Mahlzeit</>
                                        )}
                                    </Badge>
                                    <span className="text-sm font-medium truncate">{entry.name}</span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {editingId === entry.id ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-16 h-7 text-xs text-center"
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(entry)}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                {entry.itemType === 'food' ? 'g' : '×'}
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(entry)}>
                                                <Check className="h-3 w-3 text-primary" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-xs text-muted-foreground">
                                                {entry.itemType === 'food'
                                                    ? `${entry.amountGrams}g`
                                                    : `${entry.servings}× Portion`
                                                }
                                            </span>
                                            <span className="text-xs font-medium w-16 text-right">
                                                {entry.totalNutrition.kcal} kcal
                                            </span>
                                            <span className="text-xs text-muted-foreground w-12 text-right">
                                                {entry.totalNutrition.protein.toFixed(0)}g P
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                onClick={() => handleStartEdit(entry)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity text-destructive"
                                                onClick={() => handleDelete(entry.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
