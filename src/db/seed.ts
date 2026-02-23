import { db } from './database'
import type { Food, Recipe } from './schemas'

const SEED_FOODS: Food[] = [
    {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Hähnchenbrust',
        nutritionPer100g: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Basmatireis (gekocht)',
        nutritionPer100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Whey Protein Pulver',
        nutritionPer100g: { kcal: 380, protein: 78, carbs: 6, fat: 5 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Banane',
        nutritionPer100g: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Haferflocken',
        nutritionPer100g: { kcal: 372, protein: 13, carbs: 59, fat: 7 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000006',
        name: 'Skyr (Natur)',
        nutritionPer100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000007',
        name: 'Vollmilch (3,5%)',
        nutritionPer100g: { kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.5 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000008',
        name: 'Erdnussbutter',
        nutritionPer100g: { kcal: 588, protein: 25, carbs: 20, fat: 50 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-000000000009',
        name: 'Vollkornbrot',
        nutritionPer100g: { kcal: 246, protein: 8.4, carbs: 41, fat: 3.5 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-00000000000a',
        name: 'Eier (ganz)',
        nutritionPer100g: { kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-00000000000b',
        name: 'Magerquark',
        nutritionPer100g: { kcal: 67, protein: 12, carbs: 4, fat: 0.3 },
        source: 'Manual',
    },
    {
        id: '00000000-0000-0000-0000-00000000000c',
        name: 'Olivenöl',
        nutritionPer100g: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
        source: 'Manual',
    },
]

const SEED_RECIPES: Recipe[] = [
    {
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Post-Workout Shake',
        ingredients: [
            { foodId: '00000000-0000-0000-0000-000000000003', grams: 40 }, // Whey
            { foodId: '00000000-0000-0000-0000-000000000007', grams: 300 }, // Milch
            { foodId: '00000000-0000-0000-0000-000000000004', grams: 120 }, // Banane
            { foodId: '00000000-0000-0000-0000-000000000005', grams: 50 },  // Haferflocken
        ],
    },
    {
        id: '10000000-0000-0000-0000-000000000002',
        name: 'Hähnchen mit Reis',
        ingredients: [
            { foodId: '00000000-0000-0000-0000-000000000001', grams: 250 }, // Hähnchenbrust
            { foodId: '00000000-0000-0000-0000-000000000002', grams: 300 }, // Reis
            { foodId: '00000000-0000-0000-0000-00000000000c', grams: 10 },  // Olivenöl
        ],
    },
]

export async function seedDatabase() {
    const foodCount = await db.foods.count()
    if (foodCount === 0) {
        await db.foods.bulkAdd(SEED_FOODS)
        await db.recipes.bulkAdd(SEED_RECIPES)
        console.log('[NutriTracker] Seed data inserted.')
    }
}
