export function chunkText(
  text: string,
  mode: "word" | "sentence" = "word"
): string[] {
  if (mode === "sentence") {
    // split by sentence end
    return text.match(/[^.!?]+[.!?]?/g) ?? [text];
  }

  // default: word-level (preserve spaces)
  return text.split(/(\s+)/).filter(Boolean);
}
