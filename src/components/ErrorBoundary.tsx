import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught rendering error:', error, info)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            return (
                <div className="glass rounded-2xl p-8 text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Darstellungsfehler</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Beim Laden dieser Ansicht ist ein Fehler aufgetreten.
                        </p>
                        {this.state.error && (
                            <p className="text-xs text-muted-foreground mt-2 font-mono">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Erneut versuchen
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
