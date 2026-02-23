import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { db } from '@/db/database'
import { FoodDialog } from '@/components/library/FoodDialog'
import { RecipeDialog } from '@/components/library/RecipeDialog'
import { calcRecipeNutrition } from '@/hooks/useDailyLog'
import type { Food, Recipe } from '@/db/schemas'

export function LibraryPage() {
    const [tab, setTab] = useState('foods')
    const [search, setSearch] = useState('')
    const [foodDialogOpen, setFoodDialogOpen] = useState(false)
    const [editingFood, setEditingFood] = useState<Food | null>(null)
    const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)

    const foods = useLiveQuery(() => db.foods.orderBy('name').toArray()) ?? []
    const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray()) ?? []

    const filteredFoods = foods.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
    )
    const filteredRecipes = recipes.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleDeleteFood = async (id: string) => {
        await db.foods.delete(id)
    }

    const handleDeleteRecipe = async (id: string) => {
        await db.recipes.delete(id)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Library</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Deine Lebensmittel & Rezepte verwalten
                    </p>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="foods">Foods ({foods.length})</TabsTrigger>
                        <TabsTrigger value="recipes">Rezepte ({recipes.length})</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Suchen..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 w-64"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                if (tab === 'foods') {
                                    setEditingFood(null)
                                    setFoodDialogOpen(true)
                                } else {
                                    setEditingRecipe(null)
                                    setRecipeDialogOpen(true)
                                }
                            }}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            {tab === 'foods' ? 'Neues Food' : 'Neues Rezept'}
                        </Button>
                    </div>
                </div>

                <TabsContent value="foods">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                                            <th className="px-4 py-3 font-medium">Name</th>
                                            <th className="px-4 py-3 font-medium text-right">Kcal</th>
                                            <th className="px-4 py-3 font-medium text-right">Protein</th>
                                            <th className="px-4 py-3 font-medium text-right">Carbs</th>
                                            <th className="px-4 py-3 font-medium text-right">Fett</th>
                                            <th className="px-4 py-3 font-medium text-right">Quelle</th>
                                            <th className="px-4 py-3 font-medium text-right w-24">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFoods.map((food) => (
                                            <tr
                                                key={food.id}
                                                className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                                            >
                                                <td className="px-4 py-3 font-medium">{food.name}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{food.nutritionPer100g.kcal}</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{food.nutritionPer100g.protein}g</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{food.nutritionPer100g.carbs}g</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{food.nutritionPer100g.fat}g</td>
                                                <td className="px-4 py-3 text-right">
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {food.source ?? 'Manual'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => {
                                                                setEditingFood(food)
                                                                setFoodDialogOpen(true)
                                                            }}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive"
                                                            onClick={() => handleDeleteFood(food.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredFoods.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                    Keine Lebensmittel gefunden
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="recipes">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                                            <th className="px-4 py-3 font-medium">Name</th>
                                            <th className="px-4 py-3 font-medium text-right">Zutaten</th>
                                            <th className="px-4 py-3 font-medium text-right">Kcal</th>
                                            <th className="px-4 py-3 font-medium text-right">Protein</th>
                                            <th className="px-4 py-3 font-medium text-right">Carbs</th>
                                            <th className="px-4 py-3 font-medium text-right">Fett</th>
                                            <th className="px-4 py-3 font-medium text-right w-24">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecipes.map((recipe) => {
                                            const n = calcRecipeNutrition(recipe, foods)
                                            return (
                                                <tr
                                                    key={recipe.id}
                                                    className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                                                >
                                                    <td className="px-4 py-3 font-medium">{recipe.name}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums">{recipe.ingredients.length}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums">{n.kcal}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums">{n.protein.toFixed(1)}g</td>
                                                    <td className="px-4 py-3 text-right tabular-nums">{n.carbs.toFixed(1)}g</td>
                                                    <td className="px-4 py-3 text-right tabular-nums">{n.fat.toFixed(1)}g</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => {
                                                                    setEditingRecipe(recipe)
                                                                    setRecipeDialogOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-destructive"
                                                                onClick={() => handleDeleteRecipe(recipe.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {filteredRecipes.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                    Keine Rezepte gefunden
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <FoodDialog
                open={foodDialogOpen}
                onOpenChange={setFoodDialogOpen}
                editingFood={editingFood}
            />
            <RecipeDialog
                open={recipeDialogOpen}
                onOpenChange={setRecipeDialogOpen}
                editingRecipe={editingRecipe}
            />
        </div>
    )
}
