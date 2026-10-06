export const CATEGORIES = ['Equities', 'Bonds', 'Mutual Funds', 'ETFs', 'IPOs'];
export const RISK_LEVELS = ['Low', 'Medium', 'High'];
export const SECTORS = [
  'Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer Discretionary',
  'Consumer Staples', 'Industrials', 'Real Estate', 'Utilities', 'Materials',
  'Communication Services', 'Automotive',
];
export const PRICE_PRESETS = [
  { label: 'Under $25', minPrice: undefined, maxPrice: 25 },
  { label: '$25 - $100', minPrice: 25, maxPrice: 100 },
  { label: '$100 - $500', minPrice: 100, maxPrice: 500 },
  { label: '$500+', minPrice: 500, maxPrice: undefined },
];
export const SORT_OPTIONS = [
  { value: '', label: 'Best match / Top movers' },
  { value: 'change_desc', label: 'Change: high to low' },
  { value: 'change_asc', label: 'Change: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'ticker', label: 'Ticker A-Z' },
  { value: 'name', label: 'Name A-Z' },
];

const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('en-US');

export const formatPrice = (n) => priceFmt.format(Number(n) || 0);
export const formatInt = (n) => intFmt.format(Number(n) || 0);
export function formatChange(n) {
  const v = Number(n) || 0;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}
export const tone = (n) => (Number(n) > 0 ? 'gain' : Number(n) < 0 ? 'loss' : 'flat');
export const toneClass = (n) => ({ gain: 'text-gain', loss: 'text-loss', flat: 'text-mute' })[tone(n)];

export const CATEGORY_DOT = {
  Equities: 'bg-volt',
  Bonds: 'bg-amber',
  'Mutual Funds': 'bg-iris',
  ETFs: 'bg-gain',
  IPOs: 'bg-ember',
};
export const RISK_CLASS = {
  Low: 'text-gain border-gain/40 bg-gain/10',
  Medium: 'text-amber border-amber/40 bg-amber/10',
  High: 'text-loss border-loss/40 bg-loss/10',
};
