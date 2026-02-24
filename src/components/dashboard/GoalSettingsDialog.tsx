import { useState, useEffect } from 'react'
import { Settings, Check } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function GoalSettingsDialog() {
    const { dailyGoals, setDailyGoals } = useAppStore()
    const [open, setOpen] = useState(false)
    const [kcal, setKcal] = useState(String(dailyGoals.kcal))
    const [protein, setProtein] = useState(String(dailyGoals.protein))

    // Reset inputs when dialog opens
    useEffect(() => {
        if (open) {
            setKcal(String(dailyGoals.kcal))
            setProtein(String(dailyGoals.protein))
        }
    }, [open, dailyGoals])

    const handleSave = () => {
        const parsedKcal = parseInt(kcal, 10)
        const parsedProtein = parseInt(protein, 10)

        if (!isNaN(parsedKcal) && !isNaN(parsedProtein) && parsedKcal > 0 && parsedProtein > 0) {
            setDailyGoals({ kcal: parsedKcal, protein: parsedProtein })
            setOpen(false)
        }
    }

    return (
        <>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setOpen(true)}>
                <Settings className="h-4 w-4" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Trockenziele anpassen</DialogTitle>
                        <DialogDescription>
                            Deine Ziele werden im Browser gespeichert. Die Ziele der einzelnen Mahlzeiten passen sich automatisch an.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="kcal-goal">Kalorienziel (kcal)</Label>
                            <Input
                                id="kcal-goal"
                                type="number"
                                value={kcal}
                                onChange={(e) => setKcal(e.target.value)}
                                min="500"
                                step="50"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="protein-goal">Protein-Ziel (g)</Label>
                            <Input
                                id="protein-goal"
                                type="number"
                                value={protein}
                                onChange={(e) => setProtein(e.target.value)}
                                min="20"
                                step="5"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                        <Button onClick={handleSave} className="gap-2">
                            <Check className="h-4 w-4" /> Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
