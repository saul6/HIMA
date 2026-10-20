import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// La escala de letra de theme.css (text-caption, text-small, ...) es font-size, no color:
// sin esto twMerge la confunde con un color y la descarta junto a text-muted-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["caption", "small", "body", "seccion", "pantalla"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
