import { useState } from 'react'
import { Copy, Check, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AIImportPayloadSchema, type AIImportPayload } from '@/db/schemas'
import { SLOT_LABELS, type SlotId } from '@/db/schemas'
import { db } from '@/db/database'
import { generateId } from '@/lib/utils'

const SYSTEM_PROMPT = `Du bist ein Ernährungs-Analyse-Assistent. Analysiere das Essens-Foto oder die Nährwerttabelle und gib ein striktes JSON in folgendem Format zurück:

{
  "newFoods": [
    {
      "name": "Name des Lebensmittels",
      "nutritionPer100g": {
        "kcal": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
      },
      "source": "AI Label Scan"
    }
  ],
  "logEntries": [
    {
      "slotId": "morning|noon|afternoon|late_afternoon|evening",
      "itemName": "Name des Lebensmittels (muss mit einem newFoods-Namen übereinstimmen)",
      "itemType": "food",
      "amountGrams": 0
    }
  ]
}

Regeln:
- Nährwerte sind IMMER pro 100g angegeben
- Schätze die tatsächlich gegessene Grammzahl und gib sie in logEntries an
- Verwende realistische Nährwert-Angaben
- Gib NUR valides JSON zurück, keine Erklärungen
- slotId muss einer der folgenden Werte sein: morning, noon, afternoon, late_afternoon, evening`

export function AIImportPage() {
    const [copied, setCopied] = useState(false)
    const [jsonInput, setJsonInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [, setPreviewData] = useState<AIImportPayload | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [editableData, setEditableData] = useState<AIImportPayload | null>(null)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(SYSTEM_PROMPT)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleParse = () => {
        setError(null)
        try {
            const raw = JSON.parse(jsonInput)
            const result = AIImportPayloadSchema.safeParse(raw)
            if (!result.success) {
                setError(`Validierungsfehler: ${result.error.issues.map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`).join(', ')}`)
                return
            }
            setPreviewData(result.data)
            setEditableData(JSON.parse(JSON.stringify(result.data)))
            setPreviewOpen(true)
        } catch {
            setError('Ungültiges JSON. Bitte prüfe die Eingabe.')
        }
    }

    const handleSave = async () => {
        if (!editableData) return

        const foodIdMap = new Map<string, string>()

        // Save new foods
        if (editableData.newFoods) {
            for (const food of editableData.newFoods) {
                const id = generateId()
                foodIdMap.set(food.name.toLowerCase(), id)
                await db.foods.add({
                    id,
                    name: food.name,
                    nutritionPer100g: food.nutritionPer100g,
                    source: food.source ?? 'AI Import',
                })
            }
        }

        // Save log entries
        if (editableData.logEntries) {
            for (const entry of editableData.logEntries) {
                const foodId = foodIdMap.get(entry.itemName.toLowerCase())
                if (!foodId) continue
                await db.logEntries.add({
                    id: generateId(),
                    date: new Date().toISOString().split('T')[0],
                    slotId: entry.slotId as SlotId,
                    itemType: entry.itemType,
                    itemId: foodId,
                    amountGrams: entry.amountGrams,
                    servings: entry.servings,
                })
            }
        }

        setPreviewOpen(false)
        setJsonInput('')
        setPreviewData(null)
        setEditableData(null)
    }

    const updateFoodNutrition = (foodIndex: number, field: string, value: number) => {
        if (!editableData?.newFoods) return
        const updated = { ...editableData }
        const foods = [...(updated.newFoods ?? [])]
        foods[foodIndex] = {
            ...foods[foodIndex],
            nutritionPer100g: { ...foods[foodIndex].nutritionPer100g, [field]: value },
        }
        updated.newFoods = foods
        setEditableData(updated)
    }

    const updateLogAmount = (logIndex: number, value: number) => {
        if (!editableData?.logEntries) return
        const updated = { ...editableData }
        const entries = [...(updated.logEntries ?? [])]
        entries[logIndex] = { ...entries[logIndex], amountGrams: value }
        updated.logEntries = entries
        setEditableData(updated)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    AI Import
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Nutze ChatGPT oder Gemini, um Lebensmittel aus Fotos zu erkennen
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Left: Prompt */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">1. System-Prompt kopieren</CardTitle>
                        <CardDescription>
                            Kopiere diesen Prompt und füge ihn zusammen mit einem Foto in ChatGPT/Gemini ein.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto border border-border">
                                {SYSTEM_PROMPT}
                            </pre>
                            <Button
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2 gap-1.5"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Kopiert!' : 'Kopieren'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Paste */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">2. KI-Antwort einfügen</CardTitle>
                        <CardDescription>
                            Füge das JSON-Resultat der KI hier ein und klicke auf "Analysieren".
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder='{"newFoods": [...], "logEntries": [...]}'
                            value={jsonInput}
                            onChange={(e) => { setJsonInput(e.target.value); setError(null) }}
                            className="min-h-[300px] font-mono text-xs"
                        />

                        {error && (
                            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button onClick={handleParse} disabled={!jsonInput.trim()} className="w-full gap-2">
                            <Sparkles className="h-4 w-4" />
                            Analysieren & Vorschau
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Preview Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent onClose={() => setPreviewOpen(false)} className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>KI-Ergebnisse überprüfen</DialogTitle>
                        <DialogDescription>
                            Überprüfe die erkannten Daten und korrigiere bei Bedarf, bevor du speicherst.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                        {/* New Foods */}
                        {editableData?.newFoods && editableData.newFoods.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Badge>Neue Foods</Badge>
                                    <span className="text-muted-foreground font-normal">
                                        {editableData.newFoods.length} erkannt
                                    </span>
                                </h3>
                                <div className="space-y-3">
                                    {editableData.newFoods.map((food, i) => (
                                        <div key={i} className="bg-muted/30 rounded-lg p-4 space-y-3">
                                            <p className="font-medium">{food.name}</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(['kcal', 'protein', 'carbs', 'fat'] as const).map((field) => (
                                                    <div key={field}>
                                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                                                            {field}
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            value={food.nutritionPer100g[field]}
                                                            onChange={(e) => updateFoodNutrition(i, field, parseFloat(e.target.value) || 0)}
                                                            className="h-8 text-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">Werte pro 100g</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Log Entries */}
                        {editableData?.logEntries && editableData.logEntries.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Badge variant="secondary">Log-Einträge</Badge>
                                    <span className="text-muted-foreground font-normal">
                                        {editableData.logEntries.length} zu loggen
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                    {editableData.logEntries.map((entry, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                                            <Badge variant="outline" className="text-[10px] shrink-0">
                                                {SLOT_LABELS[entry.slotId as SlotId] ?? entry.slotId}
                                            </Badge>
                                            <span className="flex-1 text-sm font-medium">{entry.itemName}</span>
                                            <Input
                                                type="number"
                                                value={entry.amountGrams ?? 0}
                                                onChange={(e) => updateLogAmount(i, parseFloat(e.target.value) || 0)}
                                                className="w-20 h-8 text-sm text-center"
                                            />
                                            <span className="text-xs text-muted-foreground">g</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleSave} className="gap-2">
                            <Check className="h-4 w-4" />
                            Speichern & Loggen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
