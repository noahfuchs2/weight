import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { syncToLocalStorage, restoreFromLocalStorage } from '@/db/weightBackup'

/**
 * Hook that:
 * 1. Restores weight data from localStorage on mount (if IndexedDB is empty)
 * 2. Auto-syncs weight data to localStorage on every change
 */
export function useWeightBackup() {
    const restoredRef = useRef(false)

    // One-time restore attempt on mount
    useEffect(() => {
        if (restoredRef.current) return
        restoredRef.current = true
        restoreFromLocalStorage()
    }, [])

    // Watch for changes and sync
    const goal = useLiveQuery(() => db.weightGoal.get('current'))
    const entries = useLiveQuery(() => db.weightEntries.toArray())

    useEffect(() => {
        // Only sync once both queries have resolved (not undefined)
        if (goal === undefined || entries === undefined) return
        syncToLocalStorage()
    }, [goal, entries])
}
