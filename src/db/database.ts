import Dexie, { type EntityTable } from 'dexie'
import type { Food, Recipe, LogEntry, MealRule } from './schemas'

export class NutriDB extends Dexie {
    foods!: EntityTable<Food, 'id'>
    recipes!: EntityTable<Recipe, 'id'>
    logEntries!: EntityTable<LogEntry, 'id'>
    mealRules!: EntityTable<MealRule, 'id'>

    constructor() {
        super('NutriTrackerDB')
        this.version(1).stores({
            foods: 'id, name',
            recipes: 'id, name',
            logEntries: 'id, date, slotId, [date+slotId]',
            rotationRules: 'id, slotId',
        })

        // v2: Rename rotationRules → mealRules, add type field
        this.version(2).stores({
            foods: 'id, name',
            recipes: 'id, name',
            logEntries: 'id, date, slotId, [date+slotId]',
            rotationRules: null, // delete old table
            mealRules: 'id, slotId',
        }).upgrade(async (tx) => {
            // Migrate old rotation rules to new meal rules
            const oldRules = await (tx as any).table('rotationRules').toArray()
            const mealRulesTable = tx.table('mealRules')
            for (const rule of oldRules) {
                await mealRulesTable.add({
                    id: rule.id,
                    slotId: rule.slotId,
                    type: 'rotation',
                    recipeIds: rule.recipeIds,
                    intervalDays: rule.intervalDays,
                    startDate: rule.startDate,
                })
            }
        })
    }
}

export const db = new NutriDB()
