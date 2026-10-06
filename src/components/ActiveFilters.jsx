import { memo } from 'react';
function ActiveFilters({ filters, onChange }) {
  const chips = [];
  if (filters.category) chips.push(['category', filters.category]);
  if (filters.riskLevel) chips.push([ 'riskLevel', `${filters.riskLevel} risk`]);
  if (filters.sector) chips.push(['sector', filters.sector]);
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const { minPrice: lo, maxPrice: hi } = filters;
    chips.push(['price', lo !== undefined && hi !== undefined ? `$${lo}-$${hi}` : lo !== undefined ? `$${lo}+` : `Under $${hi}`]);
  }
  if (!chips.length) return null;
  const remove = (key) => onChange(key === 'price' ? { ...filters, minPrice: undefined, maxPrice: undefined } : { ...filters, [key]: undefined });
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map(([key, label]) => (
        <li key={key}>
          <button type="button" className="chip hover:border-volt hover:text-ink" onClick={() => remove(key)} aria-label={`Remove filter ${label}`}>
            {label} <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
      <li><button type="button" className="text-xs text-volt hover:underline" onClick={() => onChange({})}>Clear all</button></li>
    </ul>
  );
}

export default memo(ActiveFilters);
