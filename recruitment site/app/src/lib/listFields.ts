// Jobs store responsibilities and skills as arrays, but recruiters edit
// them as plain text: responsibilities one per line, skills separated by
// commas or new lines.

export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function skillsToList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
