import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Sparkles, CalendarDays, Weight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

const NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/library', label: 'Library', icon: BookOpen },
    { to: '/import', label: 'AI Import', icon: Sparkles },
    { to: '/planner', label: 'Wochenplan', icon: CalendarDays },
    { to: '/weight', label: 'Gewicht', icon: Weight },
]

export function AppShell({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const { dailyGoals } = useAppStore()

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[240px] shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
                {/* Brand */}
                <div className="p-5 pb-3">
                    <h1 className="text-xl font-bold gradient-text">NutriTracker</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Ernährung · Planung · Tracking</p>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-2 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = item.to === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.to)
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/10 text-primary shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                            >
                                <item.icon className="h-4.5 w-4.5" />
                                {item.label}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-sidebar-border">
                    <div className="text-xs text-muted-foreground">
                        <p>Ziel: <span className="text-foreground font-medium">{dailyGoals.kcal.toLocaleString('de-DE')} kcal</span></p>
                        <p>Protein: <span className="text-foreground font-medium">{dailyGoals.protein}g</span></p>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-[1400px] mx-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    )
}
