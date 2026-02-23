import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Food, Recipe, LogEntry, Nutrition } from '@/db/schemas'

export interface ResolvedLogEntry extends LogEntry {
    name: string
    totalNutrition: Nutrition
}

export interface SlotSummary {
    slotId: string
    entries: ResolvedLogEntry[]
    totals: Nutrition
}

function calcFoodNutrition(food: Food, grams: number): Nutrition {
    const factor = grams / 100
    return {
        kcal: Math.round(food.nutritionPer100g.kcal * factor),
        protein: +(food.nutritionPer100g.protein * factor).toFixed(1),
        carbs: +(food.nutritionPer100g.carbs * factor).toFixed(1),
        fat: +(food.nutritionPer100g.fat * factor).toFixed(1),
    }
}

export function calcRecipeNutrition(recipe: Recipe, foods: Food[], servings = 1): Nutrition {
    const totals: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    for (const ing of recipe.ingredients) {
        const food = foods.find((f) => f.id === ing.foodId)
        if (!food) continue
        const n = calcFoodNutrition(food, ing.grams)
        totals.kcal += n.kcal
        totals.protein += n.protein
        totals.carbs += n.carbs
        totals.fat += n.fat
    }
    return {
        kcal: Math.round(totals.kcal * servings),
        protein: +(totals.protein * servings).toFixed(1),
        carbs: +(totals.carbs * servings).toFixed(1),
        fat: +(totals.fat * servings).toFixed(1),
    }
}

export function useDailyLog(date: string) {
    const entries = useLiveQuery(() => db.logEntries.where('date').equals(date).toArray(), [date]) ?? []
    const foods = useLiveQuery(() => db.foods.toArray()) ?? []
    const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []

    const resolved: ResolvedLogEntry[] = entries.map((entry) => {
        if (entry.itemType === 'food') {
            const food = foods.find((f) => f.id === entry.itemId)
            return {
                ...entry,
                name: food?.name ?? 'Unbekannt',
                totalNutrition: food ? calcFoodNutrition(food, entry.amountGrams ?? 100) : { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            }
        } else {
            const recipe = recipes.find((r) => r.id === entry.itemId)
            return {
                ...entry,
                name: recipe?.name ?? 'Unbekannt',
                totalNutrition: recipe ? calcRecipeNutrition(recipe, foods, entry.servings ?? 1) : { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            }
        }
    })

    const dayTotals: Nutrition = resolved.reduce(
        (acc, e) => ({
            kcal: acc.kcal + e.totalNutrition.kcal,
            protein: acc.protein + e.totalNutrition.protein,
            carbs: acc.carbs + e.totalNutrition.carbs,
            fat: acc.fat + e.totalNutrition.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )

    return { entries: resolved, dayTotals, foods, recipes }
}
