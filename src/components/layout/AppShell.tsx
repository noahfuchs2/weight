import { Weight } from 'lucide-react'

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="shrink-0 border-b border-sidebar-border bg-sidebar/50 backdrop-blur-md px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Weight className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold gradient-text leading-none">WeightTracker</h1>
                    <p className="text-xs text-muted-foreground mt-1 leading-none">Dein Gewichtsverlauf</p>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-6 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    )
}
