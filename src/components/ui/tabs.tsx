import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
    className?: string
}

function Tabs({ value, onValueChange, children, className }: TabsProps) {
    return (
        <div className={cn("w-full", className)} data-value={value} data-onchange={onValueChange as unknown as string}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child as React.ReactElement<TabContextProps>, { _value: value, _onValueChange: onValueChange })
                }
                return child
            })}
        </div>
    )
}

interface TabContextProps {
    _value?: string
    _onValueChange?: (value: string) => void
    className?: string
    children?: React.ReactNode
}

function TabsList({ className, children, _value, _onValueChange, ...props }: TabContextProps & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
                className
            )}
            {...props}
        >
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child as React.ReactElement<TabContextProps>, { _value, _onValueChange })
                }
                return child
            })}
        </div>
    )
}

interface TabsTriggerProps extends TabContextProps {
    value: string
}

function TabsTrigger({ value, className, children, _value, _onValueChange, ...props }: TabsTriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const isActive = _value === value
    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer",
                isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:bg-background/50 hover:text-foreground",
                className
            )}
            onClick={() => _onValueChange?.(value)}
            {...props}
        >
            {children}
        </button>
    )
}

interface TabsContentProps extends TabContextProps {
    value: string
}

function TabsContent({ value, className, children, _value, ...props }: TabsContentProps & React.HTMLAttributes<HTMLDivElement>) {
    if (_value !== value) return null
    return (
        <div className={cn("mt-4 animate-in fade-in-0 duration-200", className)} {...props}>
            {children}
        </div>
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
