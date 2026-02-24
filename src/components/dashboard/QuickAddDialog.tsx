import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { db } from '@/db/database'
import type { SlotId } from '@/db/schemas'
import { SLOT_LABELS } from '@/db/schemas'
import { ORDERED_SLOTS } from '@/stores/appStore'
import { generateId } from '@/lib/utils'

interface QuickAddDialogProps {
    selectedDate: string
}

export function QuickAddDialog({ selectedDate }: QuickAddDialogProps) {
    const [open, setOpen] = useState(false)
    const [slotId, setSlotId] = useState<SlotId>('morning')
    const [itemType, setItemType] = useState<'food' | 'recipe'>('food')
    const [selectedItemId, setSelectedItemId] = useState('')
    const [amount, setAmount] = useState('100')
    const [search, setSearch] = useState('')

    const foods = useLiveQuery(() => db.foods.toArray()) ?? []
    const recipes = useLiveQuery(() => db.recipes.toArray()) ?? []

    const items = itemType === 'food' ? foods : recipes
    const filtered = items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleSave = async () => {
        if (!selectedItemId) return
        const num = parseFloat(amount)
        if (isNaN(num) || num <= 0) return

        await db.logEntries.add({
            id: generateId(),
            date: selectedDate,
            slotId,
            itemType,
            itemId: selectedItemId,
            ...(itemType === 'food' ? { amountGrams: num } : { servings: num }),
        })

        setOpen(false)
        setSelectedItemId('')
        setAmount('100')
        setSearch('')
    }

    return (
        <>
            <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Hinzufügen
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent onClose={() => setOpen(false)}>
                    <DialogHeader>
                        <DialogTitle>Mahlzeit loggen</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Slot selection */}
                        <div>
                            <Label className="mb-2 block">Mahlzeit-Slot</Label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {ORDERED_SLOTS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSlotId(s)}
                                        className={`px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${slotId === s
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-accent'
                                            }`}
                                    >
                                        {SLOT_LABELS[s]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Type toggle */}
                        <div>
                            <Label className="mb-2 block">Typ</Label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setItemType('food'); setSelectedItemId(''); setSearch('') }}
                                    className={`flex-1 py-2 text-sm rounded-lg transition-colors cursor-pointer ${itemType === 'food' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                                        }`}
                                >
                                    Zutat
                                </button>
                                <button
                                    onClick={() => { setItemType('recipe'); setSelectedItemId(''); setSearch('') }}
                                    className={`flex-1 py-2 text-sm rounded-lg transition-colors cursor-pointer ${itemType === 'recipe' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                                        }`}
                                >
                                    Mahlzeit
                                </button>
                            </div>
                        </div>

                        {/* Search & Select */}
                        <div>
                            <Label className="mb-2 block">
                                {itemType === 'food' ? 'Zutat' : 'Mahlzeit'} auswählen
                            </Label>
                            <Input
                                placeholder="Suchen..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="mb-2"
                            />
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                                {filtered.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-3 text-center">Keine Ergebnisse</p>
                                ) : (
                                    filtered.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedItemId(item.id)}
                                            className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${selectedItemId === item.id
                                                ? 'bg-primary/15 text-primary'
                                                : 'hover:bg-muted'
                                                }`}
                                        >
                                            {item.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Amount */}
                        <div>
                            <Label className="mb-2 block">
                                {itemType === 'food' ? 'Menge (Gramm)' : 'Portionen'}
                            </Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={itemType === 'food' ? '100' : '1'}
                                min="1"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleSave} disabled={!selectedItemId}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
