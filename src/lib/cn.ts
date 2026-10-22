import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class-name composition with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
