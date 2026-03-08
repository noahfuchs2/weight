import { z } from 'zod'

// ─── Slot IDs ───
export const SlotId = z.enum(['morning', 'noon', 'afternoon', 'late_afternoon', 'evening'])
export type SlotId = z.infer<typeof SlotId>

export const SLOT_LABELS: Record<SlotId, string> = {
    morning: 'Morgens',
    noon: 'Mittags',
    afternoon: 'Nachmittags',
    late_afternoon: 'Spät Nachmittags',
    evening: 'Abends',
}

export const getSlotTargets = (dailyKcal: number, dailyProtein: number): Record<SlotId, { kcal: number; protein: number }> => {
    return {
        morning: { kcal: Math.round(dailyKcal * 0.24), protein: Math.round(dailyProtein * 0.22) },   // ~850/3500, 40/180
        noon: { kcal: Math.round(dailyKcal * 0.21), protein: Math.round(dailyProtein * 0.25) },      // ~750/3500, 45/180
        afternoon: { kcal: Math.round(dailyKcal * 0.14), protein: Math.round(dailyProtein * 0.14) }, // ~500/3500, 25/180
        late_afternoon: { kcal: Math.round(dailyKcal * 0.19), protein: Math.round(dailyProtein * 0.19) }, // ~650/3500, 35/180
        evening: { kcal: Math.round(dailyKcal * 0.22), protein: Math.round(dailyProtein * 0.20) },   // ~750/3500, 35/180
    }
}

// ─── Nutrition per 100g ───
export const NutritionSchema = z.object({
    kcal: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
})
export type Nutrition = z.infer<typeof NutritionSchema>

// ─── Food (always per 100g) ───
export const FoodSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    nutritionPer100g: NutritionSchema,
    source: z.string().optional(),
})
export type Food = z.infer<typeof FoodSchema>

// ─── Recipe ───
export const RecipeIngredientSchema = z.object({
    foodId: z.string().uuid(),
    grams: z.number().positive(),
})
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>

export const RecipeSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    ingredients: z.array(RecipeIngredientSchema).min(1),
})
export type Recipe = z.infer<typeof RecipeSchema>

// ─── Log Entry ───
export const LogEntrySchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotId: SlotId,
    itemType: z.enum(['food', 'recipe']),
    itemId: z.string().uuid(),
    amountGrams: z.number().positive().optional(),
    servings: z.number().positive().optional(),
})
export type LogEntry = z.infer<typeof LogEntrySchema>

// ─── Meal Plan / Meal Rules ───
export const MealRuleType = z.enum(['fixed', 'weekday', 'rotation'])
export type MealRuleType = z.infer<typeof MealRuleType>

export const MealRuleSchema = z.object({
    id: z.string().uuid(),
    slotId: SlotId,
    type: MealRuleType,
    // fixed: recipeIds has exactly 1 element
    // rotation: recipeIds has 1+ elements + intervalDays
    recipeIds: z.array(z.string().uuid()).optional(),
    // weekday: separate lists for weekdays (Mon-Fri) and weekends (Sat-Sun)
    weekdayRecipeIds: z.array(z.string().uuid()).optional(),
    weekendRecipeIds: z.array(z.string().uuid()).optional(),
    intervalDays: z.number().int().min(1).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type MealRule = z.infer<typeof MealRuleSchema>

// ─── AI Import Payload ───
export const AIFoodSchema = z.object({
    name: z.string().min(1),
    nutritionPer100g: NutritionSchema,
    source: z.string().optional(),
})

export const AIRecipeSchema = z.object({
    name: z.string().min(1),
    ingredients: z.array(z.object({
        foodName: z.string().min(1),
        grams: z.number().positive(),
    })).min(1),
})

export const AILogEntrySchema = z.object({
    slotId: SlotId,
    itemName: z.string().min(1),
    itemType: z.enum(['food', 'recipe']),
    amountGrams: z.number().positive().optional(),
    servings: z.number().positive().optional(),
})

export const AIImportPayloadSchema = z.object({
    newFoods: z.array(AIFoodSchema).optional(),
    newRecipes: z.array(AIRecipeSchema).optional(),
    logEntries: z.array(AILogEntrySchema).optional(),
})
export type AIImportPayload = z.infer<typeof AIImportPayloadSchema>

// ─── AI Meal Plan Import ───
export const AIMealPlanRuleSchema = z.object({
    slotId: SlotId,
    type: MealRuleType,
    // fixed & rotation
    recipeNames: z.array(z.string().min(1)).optional(),
    // weekday
    weekdayRecipeNames: z.array(z.string().min(1)).optional(),
    weekendRecipeNames: z.array(z.string().min(1)).optional(),
    // rotation only
    intervalDays: z.number().int().min(1).optional(),
})

export const AIMealPlanImportSchema = z.object({
    rules: z.array(AIMealPlanRuleSchema).min(1),
    newFoods: z.array(AIFoodSchema).optional(),
    newRecipes: z.array(AIRecipeSchema).optional(),
})
export type AIMealPlanImport = z.infer<typeof AIMealPlanImportSchema>

// ─── Meal Plan Export ───
export interface MealPlanExportRule {
    slot: string
    slotId: SlotId
    type: MealRuleType
    recipeNames?: string[]
    weekdayRecipeNames?: string[]
    weekendRecipeNames?: string[]
    intervalDays?: number
}

export interface MealPlanExport {
    exportedAt: string
    rules: MealPlanExportRule[]
    recipes: {
        name: string
        ingredients: {
            foodName: string
            grams: number
        }[]
    }[]
    foods: {
        name: string
        nutritionPer100g: {
            kcal: number
            protein: number
            carbs: number
            fat: number
        }
    }[]
}

// ─── Weight Tracking ───
export const WeightGoalSchema = z.object({
    id: z.literal('current'),
    startWeight: z.number().positive(),
    goalWeight: z.number().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    goalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type WeightGoal = z.infer<typeof WeightGoalSchema>

export const WeightEntrySchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight: z.number().positive(),
})
export type WeightEntry = z.infer<typeof WeightEntrySchema>
