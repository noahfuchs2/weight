import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Check, ChevronLeft, ChevronRight, Trash2, Sparkles, Download, Upload, Copy, AlertCircle, Utensils } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { db } from '@/db/database'
import { SLOT_LABELS, type SlotId, AIMealPlanImportSchema, type AIMealPlanImport, type MealPlanExport, type MealRuleType } from '@/db/schemas'
import type { MealRule, Recipe } from '@/db/schemas'
import { useAppStore, ORDERED_SLOTS } from '@/stores/appStore'
import { getSlotTargets } from '@/db/schemas'
import { generateId } from '@/lib/utils'
import { calcRecipeNutrition } from '@/hooks/useDailyLog'

// ─── AI Prompt for Meal Plan Generation ───
const generateAiPrompt = (
    dailyGoals: { kcal: number; protein: number },
    targets: ReturnType<typeof getSlotTargets>
) => `Du bist ein Ernährungsplan-Assistent für einen 17-jährigen Sportler (1,81m) der Muskeln aufbauen möchte.
Ziel: ${dailyGoals.kcal.toLocaleString('de-DE')} kcal und ${dailyGoals.protein}g Protein pro Tag, aufgeteilt auf 5 Mahlzeiten:
- morning (Morgens): ~${targets.morning.kcal} kcal, ${targets.morning.protein}g Protein
- noon (Mittags): ~${targets.noon.kcal} kcal, ${targets.noon.protein}g Protein  
- afternoon (Nachmittags): ~${targets.afternoon.kcal} kcal, ${targets.afternoon.protein}g Protein
- late_afternoon (Spät Nachmittags): ~${targets.late_afternoon.kcal} kcal, ${targets.late_afternoon.protein}g Protein
- evening (Abends): ~${targets.evening.kcal} kcal, ${targets.evening.protein}g Protein

Erstelle einen flexiblen Wochenplan. Es gibt 3 Regeltypen:
1. "fixed" — Jeden Tag dasselbe Gericht
2. "weekday" — Unterschiedliche Gerichte für Mo–Fr und Sa–So
3. "rotation" — Gerichte rotieren alle N Tage

Gib striktes JSON zurück:

{
  "rules": [
    {
      "slotId": "morning|noon|afternoon|late_afternoon|evening",
      "type": "fixed",
      "recipeNames": ["Rezept A"]
    },
    {
      "slotId": "noon",
      "type": "weekday",
      "weekdayRecipeNames": ["Rezept B"],
      "weekendRecipeNames": ["Rezept C"]
    },
    {
      "slotId": "evening",
      "type": "rotation",
      "recipeNames": ["Rezept D", "Rezept E"],
      "intervalDays": 2
    }
  ],
  "newFoods": [
    {
      "name": "Lebensmittel-Name",
      "nutritionPer100g": { "kcal": 0, "protein": 0, "carbs": 0, "fat": 0 },
      "source": "AI Meal Plan"
    }
  ],
  "newRecipes": [
    {
      "name": "Rezept A",
      "ingredients": [
        { "foodName": "Lebensmittel-Name", "grams": 200 }
      ]
    }
  ]
}

Regeln:
- Nutze den passenden Regeltyp je nach Slot: "fixed" wenn jeden Tag dasselbe gegessen wird, "weekday" für unterschiedliche Gerichte an Wochentagen und Wochenenden, "rotation" zum Abwechseln
- Bei "fixed": recipeNames hat genau 1 Element
- Bei "weekday": weekdayRecipeNames (Mo–Fr) und weekendRecipeNames (Sa–So) verwenden
- Bei "rotation": recipeNames mit 2+ Elementen und intervalDays angeben
- recipeNames/weekdayRecipeNames/weekendRecipeNames müssen exakt mit den Namen in newRecipes übereinstimmen
- Alle Zutaten (foodName) müssen in newFoods definiert sein
- Nährwerte sind IMMER pro 100g
- Verwende deutsche Lebensmittelnamen
- Gib NUR valides JSON zurück, keine Erklärungen`

export function PlannerPage() {
    const { dailyGoals } = useAppStore()
    const [weekOffset, setWeekOffset] = useState(0)
    const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
    const [ruleSlot, setRuleSlot] = useState<SlotId>('noon')
    const [ruleType, setRuleType] = useState<MealRuleType>('fixed')
    const [ruleRecipeIds, setRuleRecipeIds] = useState<string[]>([])
    const [ruleWeekdayRecipeIds, setRuleWeekdayRecipeIds] = useState<string[]>([])
    const [ruleWeekendRecipeIds, setRuleWeekendRecipeIds] = useState<string[]>([])
    const [ruleInterval, setRuleInterval] = useState('2')
    const [editingRule, setEditingRule] = useState<MealRule | null>(null)

    // AI Import state
    const [aiDialogOpen, setAiDialogOpen] = useState(false)
    const [aiTab, setAiTab] = useState('prompt')
    const [jsonInput, setJsonInput] = useState('')
    const [aiError, setAiError] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<AIMealPlanImport | null>(null)
    const [copied, setCopied] = useState(false)

    // Export state
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [exportJson, setExportJson] = useState('')
    const [exportCopied, setExportCopied] = useState(false)

    // Import from file state
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [importJson, setImportJson] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importPreview, setImportPreview] = useState<AIMealPlanImport | null>(null)

    const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []
    const foods = useLiveQuery(() => db.foods.toArray()) ?? []
    const rules = useLiveQuery(() => db.mealRules.toArray()) ?? []
    const logEntries = useLiveQuery(() => db.logEntries.toArray()) ?? []

    const today = new Date()
    const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    const getPlannedRecipe = (slotId: SlotId, date: Date): Recipe | null => {
        const rule = rules.find((r) => r.slotId === slotId)
        if (!rule) return null

        let recipeId: string | undefined

        switch (rule.type) {
            case 'fixed': {
                recipeId = rule.recipeIds?.[0]
                break
            }
            case 'weekday': {
                const dayOfWeek = date.getDay() // 0=Sun, 6=Sat
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                const ids = isWeekend ? rule.weekendRecipeIds : rule.weekdayRecipeIds
                recipeId = ids?.[0]
                break
            }
            case 'rotation': {
                const ids = rule.recipeIds ?? []
                if (ids.length === 0) return null
                const interval = rule.intervalDays ?? 1
                const startDate = parseISO(rule.startDate)
                const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                const cycleLength = interval * ids.length
                const cyclePosition = ((daysDiff % cycleLength) + cycleLength) % cycleLength
                const recipeIndex = Math.floor(cyclePosition / interval)
                recipeId = ids[recipeIndex]
                break
            }
        }

        if (!recipeId) return null
        return recipes.find((r) => r.id === recipeId) ?? null
    }

    const getLoggedEntryId = (slotId: SlotId, date: Date, recipeId: string): string | null => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const entry = logEntries.find(
            (e) => e.date === dateStr && e.slotId === slotId && e.itemId === recipeId
        )
        return entry ? entry.id : null
    }

    const handleUndoLog = async (entryId: string) => {
        await db.logEntries.delete(entryId)
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

    const canSaveRule = (): boolean => {
        switch (ruleType) {
            case 'fixed': return ruleRecipeIds.length === 1
            case 'weekday': return ruleWeekdayRecipeIds.length >= 1 && ruleWeekendRecipeIds.length >= 1
            case 'rotation': return ruleRecipeIds.length >= 2
        }
    }

    const handleSaveRule = async () => {
        if (!canSaveRule()) return
        const rule: MealRule = {
            id: editingRule?.id ?? generateId(),
            slotId: ruleSlot,
            type: ruleType,
            ...(ruleType === 'fixed' ? { recipeIds: ruleRecipeIds } : {}),
            ...(ruleType === 'weekday' ? { weekdayRecipeIds: ruleWeekdayRecipeIds, weekendRecipeIds: ruleWeekendRecipeIds } : {}),
            ...(ruleType === 'rotation' ? { recipeIds: ruleRecipeIds, intervalDays: parseInt(ruleInterval) || 2 } : {}),
            startDate: editingRule?.startDate ?? format(today, 'yyyy-MM-dd'),
        }
        if (editingRule) {
            await db.mealRules.update(rule.id, rule)
        } else {
            const existing = rules.find((r) => r.slotId === ruleSlot)
            if (existing) await db.mealRules.delete(existing.id)
            await db.mealRules.add(rule)
        }
        setRuleDialogOpen(false)
        setRuleRecipeIds([])
        setRuleWeekdayRecipeIds([])
        setRuleWeekendRecipeIds([])
        setEditingRule(null)
    }

    const handleDeleteRule = async (ruleId: string) => {
        await db.mealRules.delete(ruleId)
    }

    const openEditRule = (rule: MealRule) => {
        setEditingRule(rule)
        setRuleSlot(rule.slotId)
        setRuleType(rule.type)
        setRuleRecipeIds([...(rule.recipeIds ?? [])])
        setRuleWeekdayRecipeIds([...(rule.weekdayRecipeIds ?? [])])
        setRuleWeekendRecipeIds([...(rule.weekendRecipeIds ?? [])])
        setRuleInterval(String(rule.intervalDays ?? 2))
        setRuleDialogOpen(true)
    }

    // ─── AI Prompt Copy ───
    const currentPrompt = generateAiPrompt(dailyGoals, getSlotTargets(dailyGoals.kcal, dailyGoals.protein))

    const handleCopyPrompt = async () => {
        await navigator.clipboard.writeText(currentPrompt)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ─── Parse & Save AI Meal Plan ───
    const handleParseAI = () => {
        setAiError(null)
        try {
            const raw = JSON.parse(jsonInput)
            const result = AIMealPlanImportSchema.safeParse(raw)
            if (!result.success) {
                setAiError(`Validierungsfehler: ${result.error.issues.map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`).join(', ')}`)
                return
            }
            setPreviewData(result.data)
            setAiTab('preview')
        } catch {
            setAiError('Ungültiges JSON. Bitte prüfe die Eingabe.')
        }
    }

    const saveMealPlanImport = async (data: AIMealPlanImport) => {
        // 1. Create new foods
        const foodNameToId = new Map<string, string>()
        // First, map existing foods
        for (const f of foods) {
            foodNameToId.set(f.name.toLowerCase(), f.id)
        }
        // Add new foods
        if (data.newFoods) {
            for (const food of data.newFoods) {
                if (foodNameToId.has(food.name.toLowerCase())) continue
                const id = generateId()
                foodNameToId.set(food.name.toLowerCase(), id)
                await db.foods.add({
                    id,
                    name: food.name,
                    nutritionPer100g: food.nutritionPer100g,
                    source: food.source ?? 'AI Meal Plan',
                })
            }
        }

        // 2. Create new recipes
        const recipeNameToId = new Map<string, string>()
        for (const r of recipes) {
            recipeNameToId.set(r.name.toLowerCase(), r.id)
        }
        if (data.newRecipes) {
            for (const recipe of data.newRecipes) {
                if (recipeNameToId.has(recipe.name.toLowerCase())) continue
                const id = generateId()
                recipeNameToId.set(recipe.name.toLowerCase(), id)
                const ingredients = recipe.ingredients
                    .map((ing) => ({
                        foodId: foodNameToId.get(ing.foodName.toLowerCase()) ?? '',
                        grams: ing.grams,
                    }))
                    .filter((ing) => ing.foodId !== '')
                if (ingredients.length > 0) {
                    await db.recipes.add({ id, name: recipe.name, ingredients })
                }
            }
        }

        // 3. Create meal rules
        for (const rule of data.rules) {
            const resolveNames = (names?: string[]) =>
                (names ?? []).map((name) => recipeNameToId.get(name.toLowerCase()) ?? '').filter((id) => id !== '')

            // Remove existing rule for this slot
            const existing = rules.find((r) => r.slotId === rule.slotId)
            if (existing) await db.mealRules.delete(existing.id)

            const base = {
                id: generateId(),
                slotId: rule.slotId,
                type: rule.type,
                startDate: format(today, 'yyyy-MM-dd'),
            }

            switch (rule.type) {
                case 'fixed': {
                    const recipeIds = resolveNames(rule.recipeNames)
                    if (recipeIds.length === 0) continue
                    await db.mealRules.add({ ...base, recipeIds })
                    break
                }
                case 'weekday': {
                    const weekdayRecipeIds = resolveNames(rule.weekdayRecipeNames)
                    const weekendRecipeIds = resolveNames(rule.weekendRecipeNames)
                    if (weekdayRecipeIds.length === 0 && weekendRecipeIds.length === 0) continue
                    await db.mealRules.add({ ...base, weekdayRecipeIds, weekendRecipeIds })
                    break
                }
                case 'rotation': {
                    const recipeIds = resolveNames(rule.recipeNames)
                    if (recipeIds.length === 0) continue
                    await db.mealRules.add({ ...base, recipeIds, intervalDays: rule.intervalDays ?? 2 })
                    break
                }
            }
        }

        setAiDialogOpen(false)
        setPreviewData(null)
        setJsonInput('')
    }

    // ─── Export ───
    const getAllRuleRecipeIds = (rule: MealRule): string[] => {
        const ids: string[] = []
        if (rule.recipeIds) ids.push(...rule.recipeIds)
        if (rule.weekdayRecipeIds) ids.push(...rule.weekdayRecipeIds)
        if (rule.weekendRecipeIds) ids.push(...rule.weekendRecipeIds)
        return ids
    }

    const handleExport = () => {
        const exportData: MealPlanExport = {
            exportedAt: new Date().toISOString(),
            rules: rules.map((rule) => {
                const base = {
                    slot: SLOT_LABELS[rule.slotId],
                    slotId: rule.slotId,
                    type: rule.type,
                }
                switch (rule.type) {
                    case 'fixed':
                        return {
                            ...base,
                            recipeNames: (rule.recipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '').filter(Boolean),
                        }
                    case 'weekday':
                        return {
                            ...base,
                            weekdayRecipeNames: (rule.weekdayRecipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '').filter(Boolean),
                            weekendRecipeNames: (rule.weekendRecipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '').filter(Boolean),
                        }
                    case 'rotation':
                        return {
                            ...base,
                            recipeNames: (rule.recipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '').filter(Boolean),
                            intervalDays: rule.intervalDays,
                        }
                }
            }),
            recipes: recipes
                .filter((r) => rules.some((rule) => getAllRuleRecipeIds(rule).includes(r.id)))
                .map((r) => ({
                    name: r.name,
                    ingredients: r.ingredients.map((ing) => ({
                        foodName: foods.find((f) => f.id === ing.foodId)?.name ?? '',
                        grams: ing.grams,
                    })),
                })),
            foods: foods
                .filter((f) =>
                    recipes.some((r) =>
                        rules.some((rule) => getAllRuleRecipeIds(rule).includes(r.id)) &&
                        r.ingredients.some((ing) => ing.foodId === f.id)
                    )
                )
                .map((f) => ({
                    name: f.name,
                    nutritionPer100g: f.nutritionPer100g,
                })),
        }
        const json = JSON.stringify(exportData, null, 2)
        setExportJson(json)
        setExportDialogOpen(true)
    }

    const handleDownloadExport = () => {
        const blob = new Blob([exportJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `nutritracker-wochenplan-${format(today, 'yyyy-MM-dd')}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleCopyExport = async () => {
        await navigator.clipboard.writeText(exportJson)
        setExportCopied(true)
        setTimeout(() => setExportCopied(false), 2000)
    }

    // ─── Import from JSON ───
    const handleParseImport = () => {
        setImportError(null)
        try {
            const raw = JSON.parse(importJson)
            // Accept both direct AIMealPlanImport and MealPlanExport format
            if (raw.exportedAt && raw.rules) {
                // It's an export format — convert to import format
                const converted: AIMealPlanImport = {
                    rules: raw.rules.map((r: any) => ({
                        slotId: r.slotId,
                        type: r.type ?? 'rotation',
                        recipeNames: r.recipeNames,
                        weekdayRecipeNames: r.weekdayRecipeNames,
                        weekendRecipeNames: r.weekendRecipeNames,
                        intervalDays: r.intervalDays,
                    })),
                    newFoods: raw.foods?.map((f: { name: string; nutritionPer100g: { kcal: number; protein: number; carbs: number; fat: number } }) => ({
                        name: f.name,
                        nutritionPer100g: f.nutritionPer100g,
                        source: 'Import',
                    })),
                    newRecipes: raw.recipes?.map((r: { name: string; ingredients: { foodName: string; grams: number }[] }) => ({
                        name: r.name,
                        ingredients: r.ingredients,
                    })),
                }
                const result = AIMealPlanImportSchema.safeParse(converted)
                if (!result.success) {
                    setImportError(`Validierungsfehler: ${result.error.issues.map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`).join(', ')}`)
                    return
                }
                setImportPreview(result.data)
            } else {
                const result = AIMealPlanImportSchema.safeParse(raw)
                if (!result.success) {
                    setImportError(`Validierungsfehler: ${result.error.issues.map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`).join(', ')}`)
                    return
                }
                setImportPreview(result.data)
            }
        } catch {
            setImportError('Ungültiges JSON. Bitte prüfe die Eingabe.')
        }
    }

    const handleSaveImport = async () => {
        if (!importPreview) return
        await saveMealPlanImport(importPreview)
        setImportDialogOpen(false)
        setImportPreview(null)
        setImportJson('')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Wochenplan</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Plane deine Mahlzeiten mit flexiblen Regeln
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

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    variant="outline"
                    onClick={() => {
                        setEditingRule(null)
                        setRuleSlot('noon')
                        setRuleType('fixed')
                        setRuleRecipeIds([])
                        setRuleWeekdayRecipeIds([])
                        setRuleWeekendRecipeIds([])
                        setRuleInterval('2')
                        setRuleDialogOpen(true)
                    }}
                    className="gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Neue Regel
                </Button>
                <Button
                    onClick={() => {
                        setAiTab('prompt')
                        setJsonInput('')
                        setAiError(null)
                        setPreviewData(null)
                        setAiDialogOpen(true)
                    }}
                    className="gap-2"
                >
                    <Sparkles className="h-4 w-4" />
                    AI Wochenplan erstellen
                </Button>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={rules.length === 0}
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Exportieren
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setImportJson('')
                        setImportError(null)
                        setImportPreview(null)
                        setImportDialogOpen(true)
                    }}
                    className="gap-2"
                >
                    <Upload className="h-4 w-4" />
                    Importieren
                </Button>
            </div>

            {/* Active Rules */}
            {rules.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Aktive Regeln</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {rules.map((rule) => {
                                let description = ''
                                switch (rule.type) {
                                    case 'fixed':
                                        description = `Jeden Tag: ${(rule.recipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '?').join(', ')}`
                                        break
                                    case 'weekday': {
                                        const wdNames = (rule.weekdayRecipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '?').join(', ')
                                        const weNames = (rule.weekendRecipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '?').join(', ')
                                        description = `Mo\u2013Fr: ${wdNames} | Sa\u2013So: ${weNames}`
                                        break
                                    }
                                    case 'rotation':
                                        description = `Alle ${rule.intervalDays} Tage wechseln: ${(rule.recipeIds ?? []).map((id) => recipes.find((r) => r.id === id)?.name ?? '?').join(' \u2192 ')}`
                                        break
                                }
                                const typeLabel = rule.type === 'fixed' ? 'T\u00e4glich' : rule.type === 'weekday' ? 'Wochentage' : 'Rotation'
                                return (
                                    <div key={rule.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline">{SLOT_LABELS[rule.slotId]}</Badge>
                                            <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                                            <span className="text-sm">{description}</span>
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
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Week Grid */}
            <div className="overflow-x-auto">
                <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1 min-w-[900px]">
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

                    {ORDERED_SLOTS.map((slotId) => (
                        <>
                            <div key={`label-${slotId}`} className="flex items-center px-2 text-xs font-medium text-muted-foreground">
                                {SLOT_LABELS[slotId]}
                            </div>
                            {weekDays.map((day) => {
                                const recipe = getPlannedRecipe(slotId, day)
                                const loggedId = recipe ? getLoggedEntryId(slotId, day, recipe.id) : null
                                const macros = recipe ? calcRecipeNutrition(recipe, foods) : null

                                return (
                                    <div
                                        key={`${slotId}-${day.toISOString()}`}
                                        className={`relative group/slot rounded-lg border p-2 min-h-[85px] text-xs transition-colors flex flex-col ${loggedId
                                            ? 'bg-primary/10 border-primary/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]'
                                            : recipe
                                                ? 'border-border hover:border-primary/50 bg-card hover:shadow-sm'
                                                : 'border-border/40 bg-muted/5'
                                            }`}
                                    >
                                        {recipe ? (
                                            <div className="space-y-1.5 flex-1 flex flex-col">
                                                <p className="font-medium line-clamp-2 flex items-start gap-1.5 text-foreground leading-snug">
                                                    <Utensils className="h-3 w-3 text-primary mt-[2px] shrink-0 opacity-80" />
                                                    {recipe.name}
                                                </p>
                                                {macros && (
                                                    <div className="mt-auto pt-1">
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                            <span className="font-medium text-foreground/70">{macros.kcal}</span> kcal · <span className="font-medium text-foreground/70">{macros.protein.toFixed(0)}g</span> P
                                                        </p>
                                                    </div>
                                                )}
                                                {loggedId ? (
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-[26px] text-[10px] w-full mt-2 group-hover/slot:bg-destructive group-hover/slot:text-destructive-foreground transition-all duration-300 relative overflow-hidden font-medium"
                                                        onClick={() => handleUndoLog(loggedId)}
                                                    >
                                                        <span className="flex items-center gap-1.5 group-hover/slot:-translate-y-full transition-transform duration-300 absolute inset-0 justify-center">
                                                            <Check className="h-3 w-3" /> Geloggt
                                                        </span>
                                                        <span className="flex items-center gap-1.5 translate-y-full group-hover/slot:translate-y-0 transition-transform duration-300 absolute inset-0 justify-center">
                                                            <Trash2 className="h-3 w-3" /> Rückgängig
                                                        </span>
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-[26px] text-[10px] w-full mt-2 bg-background/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 font-medium opacity-0 group-hover/slot:opacity-100"
                                                        onClick={() => handleQuickLog(slotId, day, recipe.id)}
                                                    >
                                                        <Check className="h-3 w-3 mr-1.5" /> Loggen
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center opacity-30 group-hover/slot:opacity-60 transition-opacity">
                                                <p className="text-[10px] font-medium tracking-wide uppercase">—</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ))}
                </div>
            </div>

            {/* ═══ Rule Dialog ═══ */}
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                <DialogContent onClose={() => setRuleDialogOpen(false)}>
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? 'Regel bearbeiten' : 'Neue Regel'}
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
                            <Label className="mb-2 block">Regeltyp</Label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {([['fixed', 'T\u00e4glich'], ['weekday', 'Wochentage'], ['rotation', 'Rotation']] as const).map(([type, label]) => (
                                    <button
                                        key={type}
                                        onClick={() => setRuleType(type)}
                                        className={`px-3 py-2 text-xs rounded-md transition-colors cursor-pointer ${ruleType === type
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-accent'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                                {ruleType === 'fixed' && 'Jeden Tag dasselbe Gericht'}
                                {ruleType === 'weekday' && 'Unterschiedliche Gerichte f\u00fcr Mo\u2013Fr und Sa\u2013So'}
                                {ruleType === 'rotation' && 'Gerichte rotieren alle N Tage'}
                            </p>
                        </div>

                        {/* Fixed & Rotation: single recipe list */}
                        {(ruleType === 'fixed' || ruleType === 'rotation') && (
                            <div>
                                <Label className="mb-2 block">
                                    {ruleType === 'fixed' ? 'Mahlzeit ausw\u00e4hlen' : 'Mahlzeiten (min. 2 ausw\u00e4hlen)'}
                                </Label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {recipes.map((r) => {
                                        const selected = ruleRecipeIds.includes(r.id)
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    if (ruleType === 'fixed') {
                                                        setRuleRecipeIds(selected ? [] : [r.id])
                                                    } else {
                                                        if (selected) {
                                                            setRuleRecipeIds(ruleRecipeIds.filter((id) => id !== r.id))
                                                        } else {
                                                            setRuleRecipeIds([...ruleRecipeIds, r.id])
                                                        }
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
                                            Erstelle zuerst Mahlzeiten in der Library
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Weekday: Two separate recipe lists */}
                        {ruleType === 'weekday' && (
                            <>
                                <div>
                                    <Label className="mb-2 block">Mo–Fr Mahlzeit</Label>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {recipes.map((r) => {
                                            const selected = ruleWeekdayRecipeIds.includes(r.id)
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setRuleWeekdayRecipeIds(selected ? [] : [r.id])}
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
                                    </div>
                                </div>
                                <div>
                                    <Label className="mb-2 block">Sa–So Mahlzeit</Label>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {recipes.map((r) => {
                                            const selected = ruleWeekendRecipeIds.includes(r.id)
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setRuleWeekendRecipeIds(selected ? [] : [r.id])}
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
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Rotation: interval input */}
                        {ruleType === 'rotation' && (
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
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleSaveRule} disabled={!canSaveRule()}>
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ AI Meal Plan Dialog ═══ */}
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                <DialogContent onClose={() => setAiDialogOpen(false)} className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            AI Wochenplan erstellen
                        </DialogTitle>
                        <DialogDescription>
                            Lass dir einen kompletten Wochenplan von ChatGPT oder Gemini generieren.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs value={aiTab} onValueChange={setAiTab}>
                        <TabsList>
                            <TabsTrigger value="prompt">1. Prompt</TabsTrigger>
                            <TabsTrigger value="paste">2. JSON einfügen</TabsTrigger>
                            <TabsTrigger value="preview" disabled={!previewData}>3. Vorschau</TabsTrigger>
                        </TabsList>

                        <TabsContent value="prompt">
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Kopiere diesen Prompt, füge ihn in ChatGPT/Gemini ein und beschreibe deine Vorlieben
                                    (z.B. "Ich mag Reis, Hähnchen, Quark und Shakes").
                                </p>
                                <div className="relative">
                                    <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[350px] overflow-y-auto border border-border">
                                        {currentPrompt}
                                    </pre>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="absolute top-2 right-2 gap-1.5"
                                        onClick={handleCopyPrompt}
                                    >
                                        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                                        {copied ? 'Kopiert!' : 'Kopieren'}
                                    </Button>
                                </div>
                                <Button onClick={() => setAiTab('paste')} className="w-full">
                                    Weiter zu Schritt 2 →
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="paste">
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Füge die KI-Antwort (JSON) hier ein:
                                </p>
                                <Textarea
                                    placeholder='{"rules": [...], "newFoods": [...], "newRecipes": [...]}'
                                    value={jsonInput}
                                    onChange={(e) => { setJsonInput(e.target.value); setAiError(null) }}
                                    className="min-h-[300px] font-mono text-xs"
                                />
                                {aiError && (
                                    <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        {aiError}
                                    </div>
                                )}
                                <Button onClick={handleParseAI} disabled={!jsonInput.trim()} className="w-full gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Analysieren & Vorschau
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="preview">
                            {previewData && (
                                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                                    {/* Rules Preview */}
                                    <div>
                                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <Badge>Regeln</Badge>
                                            <span className="text-muted-foreground font-normal">
                                                {previewData.rules.length} Regeln
                                            </span>
                                        </h3>
                                        <div className="space-y-2">
                                            {previewData.rules.map((rule, i) => {
                                                const typeLabel = rule.type === 'fixed' ? 'T\u00e4glich' : rule.type === 'weekday' ? 'Wochentage' : 'Rotation'
                                                let desc = ''
                                                switch (rule.type) {
                                                    case 'fixed': desc = (rule.recipeNames ?? []).join(', '); break
                                                    case 'weekday': desc = `Mo\u2013Fr: ${(rule.weekdayRecipeNames ?? []).join(', ')} | Sa\u2013So: ${(rule.weekendRecipeNames ?? []).join(', ')}`; break
                                                    case 'rotation': desc = `Alle ${rule.intervalDays} Tage: ${(rule.recipeNames ?? []).join(' \u2192 ')}`; break
                                                }
                                                return (
                                                    <div key={i} className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                                                        <Badge variant="outline">{SLOT_LABELS[rule.slotId] ?? rule.slotId}</Badge>
                                                        <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                                                        <span className="text-sm">{desc}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* New Recipes */}
                                    {previewData.newRecipes && previewData.newRecipes.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <Badge variant="secondary">Neue Mahlzeiten</Badge>
                                                <span className="text-muted-foreground font-normal">
                                                    {previewData.newRecipes.length} Mahlzeiten
                                                </span>
                                            </h3>
                                            <div className="space-y-2">
                                                {previewData.newRecipes.map((r, i) => (
                                                    <div key={i} className="bg-muted/30 rounded-lg p-3">
                                                        <p className="font-medium text-sm mb-1">{r.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {r.ingredients.map((ing) => `${ing.grams}g ${ing.foodName}`).join(', ')}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* New Foods */}
                                    {previewData.newFoods && previewData.newFoods.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <Badge variant="secondary">Neue Zutaten</Badge>
                                                <span className="text-muted-foreground font-normal">
                                                    {previewData.newFoods.length} Zutaten
                                                </span>
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {previewData.newFoods.map((f, i) => (
                                                    <div key={i} className="bg-muted/30 rounded-lg p-2 text-xs">
                                                        <p className="font-medium">{f.name}</p>
                                                        <p className="text-muted-foreground">
                                                            {f.nutritionPer100g.kcal} kcal · {f.nutritionPer100g.protein}g P
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Abbrechen</Button>
                                        <Button onClick={() => saveMealPlanImport(previewData)} className="gap-2">
                                            <Check className="h-4 w-4" />
                                            Wochenplan übernehmen
                                        </Button>
                                    </DialogFooter>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* ═══ Export Dialog ═══ */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent onClose={() => setExportDialogOpen(false)} className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5 text-primary" />
                            Wochenplan exportieren
                        </DialogTitle>
                        <DialogDescription>
                            Exportiere deinen aktuellen Wochenplan als JSON. Du kannst ihn später wieder importieren
                            oder mit anderen teilen.
                        </DialogDescription>
                    </DialogHeader>
                    <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto border border-border">
                        {exportJson}
                    </pre>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCopyExport} className="gap-2">
                            {exportCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                            {exportCopied ? 'Kopiert!' : 'Kopieren'}
                        </Button>
                        <Button onClick={handleDownloadExport} className="gap-2">
                            <Download className="h-4 w-4" />
                            Als Datei herunterladen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Import Dialog ═══ */}
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogContent onClose={() => setImportDialogOpen(false)} className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Wochenplan importieren
                        </DialogTitle>
                        <DialogDescription>
                            Füge ein zuvor exportiertes JSON oder ein AI-generiertes Meal-Plan-JSON ein.
                        </DialogDescription>
                    </DialogHeader>

                    {!importPreview ? (
                        <div className="space-y-4">
                            <Textarea
                                placeholder="JSON hier einfügen..."
                                value={importJson}
                                onChange={(e) => { setImportJson(e.target.value); setImportError(null) }}
                                className="min-h-[250px] font-mono text-xs"
                            />
                            {importError && (
                                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    {importError}
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Abbrechen</Button>
                                <Button onClick={handleParseImport} disabled={!importJson.trim()} className="gap-2">
                                    Validieren & Vorschau
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Badge>Vorschau</Badge>
                            </h3>
                            <div className="space-y-2">
                                {importPreview.rules.map((rule, i) => {
                                    const typeLabel = rule.type === 'fixed' ? 'T\u00e4glich' : rule.type === 'weekday' ? 'Wochentage' : 'Rotation'
                                    let desc = ''
                                    switch (rule.type) {
                                        case 'fixed': desc = (rule.recipeNames ?? []).join(', '); break
                                        case 'weekday': desc = `Mo\u2013Fr: ${(rule.weekdayRecipeNames ?? []).join(', ')} | Sa\u2013So: ${(rule.weekendRecipeNames ?? []).join(', ')}`; break
                                        case 'rotation': desc = `Alle ${rule.intervalDays} Tage: ${(rule.recipeNames ?? []).join(' \u2192 ')}`; break
                                    }
                                    return (
                                        <div key={i} className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                                            <Badge variant="outline">{SLOT_LABELS[rule.slotId] ?? rule.slotId}</Badge>
                                            <Badge variant="secondary" className="text-[10px]">{typeLabel}</Badge>
                                            <span className="text-sm">{desc}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            {importPreview.newRecipes && importPreview.newRecipes.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    + {importPreview.newRecipes.length} neue Rezepte und {importPreview.newFoods?.length ?? 0} neue Foods werden erstellt
                                </p>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setImportPreview(null)}>Zurück</Button>
                                <Button onClick={handleSaveImport} className="gap-2">
                                    <Check className="h-4 w-4" />
                                    Importieren
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
