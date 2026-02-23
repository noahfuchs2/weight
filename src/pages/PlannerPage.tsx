import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { db } from '@/db/database'
import { SLOT_LABELS, type SlotId } from '@/db/schemas'
import type { RotationRule, Recipe } from '@/db/schemas'
import { ORDERED_SLOTS } from '@/stores/appStore'
import { generateId } from '@/lib/utils'
import { calcRecipeNutrition } from '@/hooks/useDailyLog'

export function PlannerPage() {
    const [weekOffset, setWeekOffset] = useState(0)
    const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
    const [ruleSlot, setRuleSlot] = useState<SlotId>('noon')
    const [ruleRecipeIds, setRuleRecipeIds] = useState<string[]>([])
    const [ruleInterval, setRuleInterval] = useState('2')
    const [editingRule, setEditingRule] = useState<RotationRule | null>(null)

    const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []
    const foods = useLiveQuery(() => db.foods.toArray()) ?? []
    const rules = useLiveQuery(() => db.rotationRules.toArray()) ?? []
    const logEntries = useLiveQuery(() => db.logEntries.toArray()) ?? []

    const today = new Date()
    const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    const getPlannedRecipe = (slotId: SlotId, date: Date): Recipe | null => {
        const rule = rules.find((r) => r.slotId === slotId)
        if (!rule || rule.recipeIds.length === 0) return null

        const startDate = parseISO(rule.startDate)
        const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const cycleLength = rule.intervalDays * rule.recipeIds.length
        const cyclePosition = ((daysDiff % cycleLength) + cycleLength) % cycleLength
        const recipeIndex = Math.floor(cyclePosition / rule.intervalDays)
        const recipeId = rule.recipeIds[recipeIndex]

        return recipes.find((r) => r.id === recipeId) ?? null
    }

    const isLogged = (slotId: SlotId, date: Date, recipeId: string): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd')
        return logEntries.some(
            (e) => e.date === dateStr && e.slotId === slotId && e.itemId === recipeId
        )
    }

    const handleQuickLog = async (slotId: SlotId, date: Date, recipeId: string) => {
        await db.logEntries.add({
            id: generateId(),
            date: format(date, 'yyyy-MM-dd'),
            slotId,
            itemType: 'recipe',
            itemId: recipeId,
            servings: 1,
        })
    }

    const handleSaveRule = async () => {
        if (ruleRecipeIds.length < 2) return
        const rule: RotationRule = {
            id: editingRule?.id ?? generateId(),
            slotId: ruleSlot,
            recipeIds: ruleRecipeIds,
            intervalDays: parseInt(ruleInterval) || 2,
            startDate: format(today, 'yyyy-MM-dd'),
        }
        if (editingRule) {
            await db.rotationRules.update(rule.id, rule)
        } else {
            // Remove existing rule for this slot
            const existing = rules.find((r) => r.slotId === ruleSlot)
            if (existing) await db.rotationRules.delete(existing.id)
            await db.rotationRules.add(rule)
        }
        setRuleDialogOpen(false)
        setRuleRecipeIds([])
        setEditingRule(null)
    }

    const handleDeleteRule = async (ruleId: string) => {
        await db.rotationRules.delete(ruleId)
    }

    const openEditRule = (rule: RotationRule) => {
        setEditingRule(rule)
        setRuleSlot(rule.slotId)
        setRuleRecipeIds([...rule.recipeIds])
        setRuleInterval(String(rule.intervalDays))
        setRuleDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Wochenplan</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Plane deine Mahlzeiten mit Rotationsregeln
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[180px] text-center">
                        {format(weekDays[0], 'd. MMM', { locale: de })} – {format(weekDays[6], 'd. MMM yyyy', { locale: de })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    {weekOffset !== 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                            Heute
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Rules */}
            {rules.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Aktive Rotationsregeln</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {rules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline">{SLOT_LABELS[rule.slotId]}</Badge>
                                        <span className="text-sm">
                                            Alle {rule.intervalDays} Tage wechseln:{' '}
                                            {rule.recipeIds
                                                .map((id) => recipes.find((r) => r.id === id)?.name ?? '?')
                                                .join(' → ')}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                                            Bearbeiten
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add Rule Button */}
            <Button
                variant="outline"
                onClick={() => {
                    setEditingRule(null)
                    setRuleSlot('noon')
                    setRuleRecipeIds([])
                    setRuleInterval('2')
                    setRuleDialogOpen(true)
                }}
                className="gap-2"
            >
                <Plus className="h-4 w-4" />
                Neue Rotationsregel
            </Button>

            {/* Week Grid */}
            <div className="overflow-x-auto">
                <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1 min-w-[900px]">
                    {/* Header */}
                    <div />
                    {weekDays.map((day) => (
                        <div
                            key={day.toISOString()}
                            className={`text-center p-2 rounded-lg text-sm font-medium ${isSameDay(day, today) ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
                                }`}
                        >
                            <div>{format(day, 'EEE', { locale: de })}</div>
                            <div className="text-lg font-bold">{format(day, 'd')}</div>
                        </div>
                    ))}

                    {/* Rows per slot */}
                    {ORDERED_SLOTS.map((slotId) => (
                        <>
                            <div key={`label-${slotId}`} className="flex items-center px-2 text-xs font-medium text-muted-foreground">
                                {SLOT_LABELS[slotId]}
                            </div>
                            {weekDays.map((day) => {
                                const recipe = getPlannedRecipe(slotId, day)
                                const logged = recipe ? isLogged(slotId, day, recipe.id) : false
                                const macros = recipe ? calcRecipeNutrition(recipe, foods) : null

                                return (
                                    <div
                                        key={`${slotId}-${day.toISOString()}`}
                                        className={`rounded-lg border p-2 min-h-[80px] text-xs transition-colors ${logged
                                                ? 'bg-primary/10 border-primary/30'
                                                : recipe
                                                    ? 'border-border hover:border-primary/30'
                                                    : 'border-border/50 bg-muted/10'
                                            }`}
                                    >
                                        {recipe ? (
                                            <div className="space-y-1">
                                                <p className="font-medium truncate">{recipe.name}</p>
                                                {macros && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {macros.kcal} kcal · {macros.protein.toFixed(0)}g P
                                                    </p>
                                                )}
                                                {logged ? (
                                                    <Badge variant="default" className="text-[9px] gap-1">
                                                        <Check className="h-2.5 w-2.5" />
                                                        Geloggt
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-[10px] w-full"
                                                        onClick={() => handleQuickLog(slotId, day, recipe.id)}
                                                    >
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Loggen
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground/50 italic">—</p>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ))}
                </div>
            </div>

            {/* Rule Dialog */}
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                <DialogContent onClose={() => setRuleDialogOpen(false)}>
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? 'Rotationsregel bearbeiten' : 'Neue Rotationsregel'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2 block">Mahlzeit-Slot</Label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {ORDERED_SLOTS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setRuleSlot(s)}
                                        className={`px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${ruleSlot === s
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-muted-foreground hover:bg-accent'
                                            }`}
                                    >
                                        {SLOT_LABELS[s]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label className="mb-2 block">Rezepte (min. 2 auswählen)</Label>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {recipes.map((r) => {
                                    const selected = ruleRecipeIds.includes(r.id)
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => {
                                                if (selected) {
                                                    setRuleRecipeIds(ruleRecipeIds.filter((id) => id !== r.id))
                                                } else {
                                                    setRuleRecipeIds([...ruleRecipeIds, r.id])
                                                }
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-between ${selected
                                                    ? 'bg-primary/15 text-primary'
                                                    : 'hover:bg-muted'
                                                }`}
                                        >
                                            {r.name}
                                            {selected && <Check className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                                {recipes.length === 0 && (
                                    <p className="text-sm text-muted-foreground p-3 text-center">
                                        Erstelle zuerst Rezepte in der Library
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label className="mb-2 block">Alle N Tage wechseln</Label>
                            <Input
                                type="number"
                                value={ruleInterval}
                                onChange={(e) => setRuleInterval(e.target.value)}
                                min="1"
                                className="w-24"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleSaveRule} disabled={ruleRecipeIds.length < 2}>
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
