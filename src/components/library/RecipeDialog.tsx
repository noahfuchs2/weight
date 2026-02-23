import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { db } from '@/db/database'
import { generateId } from '@/lib/utils'
import { calcRecipeNutrition } from '@/hooks/useDailyLog'
import type { Recipe, RecipeIngredient } from '@/db/schemas'

interface RecipeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingRecipe: Recipe | null
}

export function RecipeDialog({ open, onOpenChange, editingRecipe }: RecipeDialogProps) {
    const [name, setName] = useState('')
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
    const [searchFood, setSearchFood] = useState('')

    const foods = useLiveQuery(() => db.foods.toArray()) ?? []

    useEffect(() => {
        if (editingRecipe) {
            setName(editingRecipe.name)
            setIngredients([...editingRecipe.ingredients])
        } else {
            setName('')
            setIngredients([])
        }
    }, [editingRecipe, open])

    const filteredFoods = foods.filter(
        (f) =>
            f.name.toLowerCase().includes(searchFood.toLowerCase()) &&
            !ingredients.some((i) => i.foodId === f.id)
    )

    const addIngredient = (foodId: string) => {
        setIngredients([...ingredients, { foodId, grams: 100 }])
        setSearchFood('')
    }

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index))
    }

    const updateGrams = (index: number, grams: number) => {
        const updated = [...ingredients]
        updated[index] = { ...updated[index], grams }
        setIngredients(updated)
    }

    const recipeTotals = ingredients.length > 0
        ? calcRecipeNutrition({ id: '', name: '', ingredients }, foods)
        : { kcal: 0, protein: 0, carbs: 0, fat: 0 }

    const handleSave = async () => {
        if (!name.trim() || ingredients.length === 0) return

        const recipe: Recipe = {
            id: editingRecipe?.id ?? generateId(),
            name: name.trim(),
            ingredients,
        }

        if (editingRecipe) {
            await db.recipes.update(recipe.id, recipe)
        } else {
            await db.recipes.add(recipe)
        }

        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {editingRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-2 block">Rezeptname</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Post-Workout Shake" />
                    </div>

                    {/* Ingredients list */}
                    <div>
                        <Label className="mb-2 block">Zutaten</Label>
                        <div className="space-y-2">
                            {ingredients.map((ing, idx) => {
                                const food = foods.find((f) => f.id === ing.foodId)
                                return (
                                    <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                                        <span className="flex-1 text-sm font-medium">{food?.name ?? 'Unbekannt'}</span>
                                        <Input
                                            type="number"
                                            value={ing.grams}
                                            onChange={(e) => updateGrams(idx, parseFloat(e.target.value) || 0)}
                                            className="w-20 h-8 text-xs text-center"
                                        />
                                        <span className="text-xs text-muted-foreground">g</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeIngredient(idx)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Add ingredient */}
                        <div className="mt-2">
                            <Input
                                placeholder="Zutat suchen..."
                                value={searchFood}
                                onChange={(e) => setSearchFood(e.target.value)}
                                className="mb-1"
                            />
                            {searchFood && (
                                <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
                                    {filteredFoods.map((f) => (
                                        <button
                                            key={f.id}
                                            onClick={() => addIngredient(f.id)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
                                        >
                                            <Plus className="h-3 w-3 text-primary" />
                                            {f.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live macro totals */}
                    {ingredients.length > 0 && (
                        <div className="glass rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-2">Gesamte Nährwerte</p>
                            <div className="grid grid-cols-4 gap-3 text-center">
                                <div>
                                    <p className="text-lg font-bold text-primary">{recipeTotals.kcal}</p>
                                    <p className="text-[10px] text-muted-foreground">kcal</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-chart-3">{recipeTotals.protein.toFixed(1)}</p>
                                    <p className="text-[10px] text-muted-foreground">Protein</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-chart-5">{recipeTotals.carbs.toFixed(1)}</p>
                                    <p className="text-[10px] text-muted-foreground">Carbs</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-chart-4">{recipeTotals.fat.toFixed(1)}</p>
                                    <p className="text-[10px] text-muted-foreground">Fett</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                    <Button onClick={handleSave} disabled={!name.trim() || ingredients.length === 0}>
                        {editingRecipe ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
