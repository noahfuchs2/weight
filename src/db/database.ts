import Dexie, { type EntityTable } from 'dexie'
import type { Food, Recipe, LogEntry, RotationRule } from './schemas'

export class NutriDB extends Dexie {
    foods!: EntityTable<Food, 'id'>
    recipes!: EntityTable<Recipe, 'id'>
    logEntries!: EntityTable<LogEntry, 'id'>
    rotationRules!: EntityTable<RotationRule, 'id'>

    constructor() {
        super('NutriTrackerDB')
        this.version(1).stores({
            foods: 'id, name',
            recipes: 'id, name',
            logEntries: 'id, date, slotId, [date+slotId]',
            rotationRules: 'id, slotId',
        })
    }
}

export const db = new NutriDB()
