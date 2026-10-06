// Returns e.g. [1,'gap-l',4,5,6,7,8,'gap-r',36] for page 6 of 36.
export function getPageItems(page, total, siblings = 2) {
  if (total <= 1) return [1];
  const first = 1;
  const start = Math.max(first + 1, page - siblings);
  const end = Math.min(total - 1, page + siblings);
  const items = [first];
  if (start > first + 1) items.push('gap-l');
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total - 1) items.push('gap-r');
  items.push(total);
  return items;
}
