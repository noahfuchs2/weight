import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import type { SlotId } from '@/db/schemas'

interface AppState {
    selectedDate: string
    setSelectedDate: (date: string) => void
    goToToday: () => void

    dailyGoals: {
        kcal: number
        protein: number
    }
    setDailyGoals: (goals: { kcal: number; protein: number }) => void
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            selectedDate: format(new Date(), 'yyyy-MM-dd'),
            setSelectedDate: (date) => set({ selectedDate: date }),
            goToToday: () => set({ selectedDate: format(new Date(), 'yyyy-MM-dd') }),

            dailyGoals: {
                kcal: 3500,
                protein: 180,
            },
            setDailyGoals: (goals) => set({ dailyGoals: goals }),
        }),
        {
            name: 'nutritracker-app-storage',
            partialize: (state) => ({ dailyGoals: state.dailyGoals }),
        }
    )
)

// ─── Ordered slot list ───
export const ORDERED_SLOTS: SlotId[] = [
    'morning',
    'noon',
    'afternoon',
    'late_afternoon',
    'evening',
]
