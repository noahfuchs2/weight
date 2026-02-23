import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { db } from '@/db/database'
import { generateId } from '@/lib/utils'
import type { Food } from '@/db/schemas'

interface FoodDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingFood: Food | null
}

export function FoodDialog({ open, onOpenChange, editingFood }: FoodDialogProps) {
    const [name, setName] = useState('')
    const [kcal, setKcal] = useState('')
    const [protein, setProtein] = useState('')
    const [carbs, setCarbs] = useState('')
    const [fat, setFat] = useState('')

    useEffect(() => {
        if (editingFood) {
            setName(editingFood.name)
            setKcal(String(editingFood.nutritionPer100g.kcal))
            setProtein(String(editingFood.nutritionPer100g.protein))
            setCarbs(String(editingFood.nutritionPer100g.carbs))
            setFat(String(editingFood.nutritionPer100g.fat))
        } else {
            setName('')
            setKcal('')
            setProtein('')
            setCarbs('')
            setFat('')
        }
    }, [editingFood, open])

    const handleSave = async () => {
        if (!name.trim()) return
        const food: Food = {
            id: editingFood?.id ?? generateId(),
            name: name.trim(),
            nutritionPer100g: {
                kcal: parseFloat(kcal) || 0,
                protein: parseFloat(protein) || 0,
                carbs: parseFloat(carbs) || 0,
                fat: parseFloat(fat) || 0,
            },
            source: editingFood?.source ?? 'Manual',
        }

        if (editingFood) {
            await db.foods.update(food.id, food)
        } else {
            await db.foods.add(food)
        }

        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editingFood ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-2 block">Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Hähnchenbrust" />
                    </div>

                    <p className="text-xs text-muted-foreground">Nährwerte pro 100g</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="mb-1.5 block text-xs">Kalorien (kcal)</Label>
                            <Input type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-xs">Protein (g)</Label>
                            <Input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-xs">Kohlenhydrate (g)</Label>
                            <Input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-xs">Fett (g)</Label>
                            <Input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        {editingFood ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
