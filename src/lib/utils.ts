import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatNumber(n: number, decimals = 0): string {
    return n.toFixed(decimals).replace(/\.0+$/, '')
}

export function generateId(): string {
    return crypto.randomUUID()
}
