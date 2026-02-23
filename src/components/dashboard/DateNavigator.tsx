import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { format, addDays, subDays, isToday, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'

export function DateNavigator() {
    const { selectedDate, setSelectedDate, goToToday } = useAppStore()
    const dateObj = parseISO(selectedDate)
    const today = isToday(dateObj)

    return (
        <div className="flex items-center gap-3">
            <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'))}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-2 min-w-[200px] justify-center">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">
                    {format(dateObj, 'EEEE, d. MMMM', { locale: de })}
                </span>
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>

            {!today && (
                <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2 text-xs">
                    Heute
                </Button>
            )}
        </div>
    )
}
