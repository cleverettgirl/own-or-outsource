// Turns the design's inline CSS strings ("display:flex;gap:8px") into React style objects.
// Keeps the ported template close to the original markup. Results are cached per string.
const cache = new Map();

export function css(text) {
  let style = cache.get(text);
  if (style) return style;
  style = {};
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop) continue;
    style[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  cache.set(text, style);
  return style;
}
