import { db } from './database'
import { WeightGoalSchema, WeightEntrySchema } from './schemas'
import { z } from 'zod'

const LS_KEY = 'nutri_weight_backup'

// ─── Backup Shape ───
const BackupSchema = z.object({
    version: z.literal(1),
    exportedAt: z.string(),
    goal: WeightGoalSchema.nullable(),
    entries: z.array(WeightEntrySchema),
})
type WeightBackup = z.infer<typeof BackupSchema>

// ─── Sync to LocalStorage ───
export async function syncToLocalStorage(): Promise<void> {
    try {
        const goal = (await db.weightGoal.get('current')) ?? null
        const entries = await db.weightEntries.orderBy('date').toArray()

        const backup: WeightBackup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            goal,
            entries,
        }
        localStorage.setItem(LS_KEY, JSON.stringify(backup))
    } catch (err) {
        console.warn('[weightBackup] sync to localStorage failed:', err)
    }
}

// ─── Restore from LocalStorage ───
// Returns true if data was restored, false otherwise
export async function restoreFromLocalStorage(): Promise<boolean> {
    try {
        // Only restore if IndexedDB is empty
        const existingGoal = await db.weightGoal.get('current')
        const existingCount = await db.weightEntries.count()
        if (existingGoal || existingCount > 0) return false

        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return false

        const parsed = BackupSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) {
            console.warn('[weightBackup] invalid localStorage backup:', parsed.error)
            return false
        }

        const { goal, entries } = parsed.data

        await db.transaction('rw', [db.weightGoal, db.weightEntries], async () => {
            if (goal) await db.weightGoal.put(goal)
            if (entries.length > 0) await db.weightEntries.bulkPut(entries)
        })

        console.info(`[weightBackup] restored ${entries.length} entries from localStorage`)
        return true
    } catch (err) {
        console.warn('[weightBackup] restore from localStorage failed:', err)
        return false
    }
}

// ─── Export as JSON file download ───
export async function exportWeightData(): Promise<void> {
    const goal = (await db.weightGoal.get('current')) ?? null
    const entries = await db.weightEntries.orderBy('date').toArray()

    const backup: WeightBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        goal,
        entries,
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().slice(0, 10)

    const a = document.createElement('a')
    a.href = url
    a.download = `gewicht_backup_${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// ─── Import from JSON file ───
// Returns the number of entries imported
export async function importWeightData(file: File): Promise<number> {
    const text = await file.text()
    const json = JSON.parse(text)

    const parsed = BackupSchema.safeParse(json)
    if (!parsed.success) {
        throw new Error('Ungültiges Backup-Format. Bitte eine gültige Backup-Datei auswählen.')
    }

    const { goal, entries } = parsed.data

    await db.transaction('rw', [db.weightGoal, db.weightEntries], async () => {
        // Only overwrite goal if backup contains one
        if (goal) {
            await db.weightGoal.clear()
            await db.weightGoal.put(goal)
        }
        // Merge entries (bulkPut = upsert by id, preserves existing entries for other dates)
        if (entries.length > 0) await db.weightEntries.bulkPut(entries)
    })

    // Also sync to localStorage immediately
    await syncToLocalStorage()

    return entries.length
}
