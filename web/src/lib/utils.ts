import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "1 item", "2 items" */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
