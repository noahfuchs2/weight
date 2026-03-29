import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { Scale, Plus, RotateCcw, Target, TrendingUp, Calendar, Pencil, X, Check, Download, Upload } from 'lucide-react'
import { db } from '@/db/database'
import type { WeightGoal } from '@/db/schemas'
import { WeightChart } from '@/components/weight/WeightChart'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useWeightBackup } from '@/hooks/useWeightBackup'
import { exportWeightData, importWeightData } from '@/db/weightBackup'

/** Safely format a date string, returns fallback on invalid input */
function safeFormatDate(dateStr: string, fmt: string, fallback = '–'): string {
    try {
        const d = new Date(dateStr + 'T00:00:00')
        if (isNaN(d.getTime())) return fallback
        return format(d, fmt)
    } catch {
        return fallback
    }
}

export function WeightPage() {
    // useLiveQuery returns undefined while loading; we wrap to return null when no record exists
    const goal = useLiveQuery(() => db.weightGoal.get('current').then(g => g ?? null))
    const entries = useLiveQuery(() => db.weightEntries.orderBy('date').toArray(), []) ?? []

    if (goal === undefined) {
        // Still loading
        return null
    }

    if (goal === null) {
        return <SetupForm />
    }

    return (
        <ErrorBoundary>
            <TrackingView goal={goal} entries={entries} />
        </ErrorBoundary>
    )
}

// ─── Setup Form ───
function SetupForm() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const [startWeight, setStartWeight] = useState('')
    const [goalWeight, setGoalWeight] = useState('')
    const [goalDate, setGoalDate] = useState('')
    const [saving, setSaving] = useState(false)

    const canSave = startWeight && goalWeight && goalDate && Number(startWeight) > 0 && Number(goalWeight) > 0

    async function handleSave() {
        if (!canSave) return
        setSaving(true)
        try {
            await db.weightGoal.put({
                id: 'current',
                startWeight: Number(startWeight),
                goalWeight: Number(goalWeight),
                startDate: today,
                goalDate,
            })
            // Also add the starting weight as the first entry
            await db.weightEntries.add({
                id: uuid(),
                date: today,
                weight: Number(startWeight),
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Gewicht</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Setze dein Gewichtsziel, um mit dem Tracking zu starten</p>
            </div>

            {/* Setup Card */}
            <div className="glass rounded-2xl p-8 max-w-lg glow-primary">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold">Ziel definieren</h2>
                        <p className="text-xs text-muted-foreground">Startgewicht, Zielgewicht & Zeitraum</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Start Weight */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Aktuelles Gewicht (kg)
                        </label>
                        <div className="relative">
                            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="number"
                                step="0.1"
                                min="1"
                                placeholder="z.B. 75.0"
                                value={startWeight}
                                onChange={(e) => setStartWeight(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Goal Weight */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Zielgewicht (kg)
                        </label>
                        <div className="relative">
                            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="number"
                                step="0.1"
                                min="1"
                                placeholder="z.B. 80.0"
                                value={goalWeight}
                                onChange={(e) => setGoalWeight(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Goal Date */}
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Zieldatum
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="date"
                                min={today}
                                value={goalDate}
                                onChange={(e) => setGoalDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="w-full mt-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Wird gespeichert…' : 'Ziel speichern & Tracking starten'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Tracking View ───
function TrackingView({ goal, entries }: { goal: WeightGoal; entries: { id: string; date: string; weight: number }[] }) {
    // Auto-backup to localStorage
    useWeightBackup()

    const today = format(new Date(), 'yyyy-MM-dd')
    const [newWeight, setNewWeight] = useState('')
    const [trackDate, setTrackDate] = useState(today)
    const [saving, setSaving] = useState(false)
    const [importStatus, setImportStatus] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Edit goal state
    const [editing, setEditing] = useState(false)
    const [editStartWeight, setEditStartWeight] = useState('')
    const [editGoalWeight, setEditGoalWeight] = useState('')
    const [editGoalDate, setEditGoalDate] = useState('')

    const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null
    const diff = latestEntry ? latestEntry.weight - goal.startWeight : 0
    const remaining = latestEntry ? goal.goalWeight - latestEntry.weight : goal.goalWeight - goal.startWeight

    function startEditing() {
        setEditStartWeight(String(goal.startWeight))
        setEditGoalWeight(String(goal.goalWeight))
        setEditGoalDate(goal.goalDate)
        setEditing(true)
    }

    async function handleSaveEdit() {
        const sw = Number(editStartWeight)
        const gw = Number(editGoalWeight)
        if (!sw || sw <= 0 || !gw || gw <= 0 || !editGoalDate) return
        await db.weightGoal.update('current', {
            startWeight: sw,
            goalWeight: gw,
            goalDate: editGoalDate,
        })
        setEditing(false)
    }

    async function handleAddEntry() {
        const w = Number(newWeight)
        if (!w || w <= 0) return
        setSaving(true)
        try {
            // Check if entry for this date already exists & update
            const existing = await db.weightEntries.where('date').equals(trackDate).first()
            if (existing) {
                await db.weightEntries.update(existing.id, { weight: w })
            } else {
                await db.weightEntries.add({
                    id: uuid(),
                    date: trackDate,
                    weight: w,
                })
            }
            setNewWeight('')
            setTrackDate(today)
        } finally {
            setSaving(false)
        }
    }

    async function handleReset() {
        if (!confirm('Gewichtsziel wirklich zurücksetzen? Alle Einträge werden gelöscht.')) return
        await db.weightGoal.delete('current')
        await db.weightEntries.clear()
    }

    async function handleDeleteEntry(id: string) {
        await db.weightEntries.delete(id)
    }

    async function handleExport() {
        await exportWeightData()
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (!confirm('Bestehende Gewichtsdaten werden überschrieben. Fortfahren?')) {
            e.target.value = ''
            return
        }
        try {
            const count = await importWeightData(file)
            setImportStatus(`✓ ${count} Einträge importiert`)
            setTimeout(() => setImportStatus(null), 3000)
        } catch (err) {
            setImportStatus(`✗ ${err instanceof Error ? err.message : 'Import fehlgeschlagen'}`)
            setTimeout(() => setImportStatus(null), 4000)
        }
        e.target.value = ''
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gewicht</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Ziel: <span className="text-foreground font-medium">{goal.goalWeight} kg</span> bis{' '}
                        <span className="text-foreground font-medium">
                            {safeFormatDate(goal.goalDate, 'dd.MM.yyyy')}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                        title="Gewichtsdaten als JSON exportieren"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                        title="Gewichtsdaten aus JSON importieren"
                    >
                        <Upload className="h-4 w-4" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                    />
                    <button
                        onClick={startEditing}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    >
                        <Pencil className="h-4 w-4" />
                        Bearbeiten
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Zurücksetzen
                    </button>
                </div>
            </div>

            {/* Import Status Toast */}
            {importStatus && (
                <div className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    importStatus.startsWith('✓') ? 'bg-chart-3/10 text-chart-3' : 'bg-destructive/10 text-destructive'
                }`}>
                    {importStatus}
                </div>
            )}

            {/* Edit Goal Inline */}
            {editing && (
                <div className="glass rounded-2xl p-6 glow-primary">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium">Ziel bearbeiten</h3>
                        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Startgewicht (kg)</label>
                            <div className="relative">
                                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    value={editStartWeight}
                                    onChange={(e) => setEditStartWeight(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Zielgewicht (kg)</label>
                            <div className="relative">
                                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    value={editGoalWeight}
                                    onChange={(e) => setEditGoalWeight(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Zieldatum</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={editGoalDate}
                                    onChange={(e) => setEditGoalDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveEdit}
                        disabled={!editStartWeight || !editGoalWeight || !editGoalDate || Number(editStartWeight) <= 0 || Number(editGoalWeight) <= 0}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Check className="h-4 w-4" />
                        Änderungen speichern
                    </button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Aktuell</p>
                    <p className="text-xl font-bold text-primary">
                        {latestEntry ? latestEntry.weight : goal.startWeight}
                        <span className="text-sm font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Veränderung</p>
                    <p className={`text-xl font-bold ${diff > 0 ? 'text-chart-3' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Noch übrig</p>
                    <p className="text-xl font-bold text-chart-2">
                        {remaining > 0 ? '+' : ''}{remaining.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-0.5">kg</span>
                    </p>
                </div>
            </div>

            {/* Chart */}
            <WeightChart goal={goal} entries={entries} />

            {/* Add Entry */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-chart-3" />
                    </div>
                    <h3 className="text-sm font-medium">Gewicht eintragen</h3>
                </div>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            placeholder="Gewicht in kg"
                            value={newWeight}
                            onChange={(e) => setNewWeight(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="date"
                            value={trackDate}
                            onChange={(e) => setTrackDate(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark]"
                        />
                    </div>
                    <button
                        onClick={handleAddEntry}
                        disabled={!newWeight || Number(newWeight) <= 0 || saving}
                        className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Speichern
                    </button>
                </div>
            </div>

            {/* Entry History */}
            {entries.length > 0 && (
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Verlauf</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {[...entries].reverse().map((entry, i) => {
                            const prev = entries.length > 1 && i < entries.length - 1
                                ? [...entries].reverse()[i + 1]
                                : null
                            const entryDiff = prev ? entry.weight - prev.weight : null

                            return (
                                <div
                                    key={entry.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground w-20">
                                            {safeFormatDate(entry.date, 'dd.MM.yyyy')}
                                        </span>
                                        <span className="text-sm font-medium">{entry.weight} kg</span>
                                        {entryDiff !== null && (
                                            <span className={`text-xs ${entryDiff > 0 ? 'text-chart-3' : entryDiff < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                {entryDiff > 0 ? '▲' : entryDiff < 0 ? '▼' : '─'} {Math.abs(entryDiff).toFixed(1)} kg
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        Löschen
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
