export const CURRENCIES = [
  { code: 'USD', symbol: '$',   label: 'US Dollar (USD)' },
  { code: 'PHP', symbol: '₱',  label: 'Philippine Peso (PHP)' },
  { code: 'EUR', symbol: '€',  label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£',  label: 'British Pound (GBP)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (CAD)' },
  { code: 'JPY', symbol: '¥',  label: 'Japanese Yen (JPY)' },
  { code: 'CNY', symbol: '¥',  label: 'Chinese Yuan (CNY)' },
  { code: 'HKD', symbol: 'HK$',label: 'Hong Kong Dollar (HKD)' },
  { code: 'KRW', symbol: '₩',  label: 'South Korean Won (KRW)' },
  { code: 'TWD', symbol: 'NT$',label: 'Taiwan Dollar (TWD)' },
  { code: 'THB', symbol: '฿',  label: 'Thai Baht (THB)' },
  { code: 'VND', symbol: '₫',  label: 'Vietnamese Dong (VND)' },
  { code: 'INR', symbol: '₹',  label: 'Indian Rupee (INR)' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit (MYR)' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah (IDR)' },
  { code: 'BDT', symbol: '৳',  label: 'Bangladeshi Taka (BDT)' },
  { code: 'PKR', symbol: '₨',  label: 'Pakistani Rupee (PKR)' },
  { code: 'AED', symbol: 'د.إ',label: 'UAE Dirham (AED)' },
  { code: 'SAR', symbol: '﷼',  label: 'Saudi Riyal (SAR)' },
  { code: 'ZAR', symbol: 'R',  label: 'South African Rand (ZAR)' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real (BRL)' },
  { code: 'MXN', symbol: 'MX$',label: 'Mexican Peso (MXN)' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc (CHF)' },
  { code: 'NZD', symbol: 'NZ$',label: 'New Zealand Dollar (NZD)' },
];

export function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}
