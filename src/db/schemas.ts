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

export const SLOT_TARGETS: Record<SlotId, { kcal: number; protein: number }> = {
    morning: { kcal: 850, protein: 40 },
    noon: { kcal: 750, protein: 45 },
    afternoon: { kcal: 500, protein: 25 },
    late_afternoon: { kcal: 650, protein: 35 },
    evening: { kcal: 750, protein: 35 },
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

// ─── Meal Plan / Rotation Rules ───
export const RotationRuleSchema = z.object({
    id: z.string().uuid(),
    slotId: SlotId,
    recipeIds: z.array(z.string().uuid()).min(2),
    intervalDays: z.number().int().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type RotationRule = z.infer<typeof RotationRuleSchema>

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
