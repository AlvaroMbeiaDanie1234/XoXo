export type CurrencyCode = 'AOA' | 'BRL' | 'USD' | 'EUR' | 'MZN'
export type WithdrawalCountryCode = 'AO' | 'BR' | 'MZ'

export interface CurrencyOption {
  code: CurrencyCode
  symbol: string
  name: string
}

export interface WithdrawalCountry {
  code: WithdrawalCountryCode
  name: string
  flag: string
  defaultCurrency: CurrencyCode
  hint: string
}

export interface BankFieldConfig {
  key: keyof BankDetailsForm
  label: string
  placeholder?: string
  required?: boolean
  type?: 'text' | 'textarea'
}

export interface BankDetailsForm {
  bank_account_name: string
  bank_name: string
  bank_account_number: string
  bank_branch: string
  bank_pix: string
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'AOA', symbol: 'AOA', name: 'Kwanza (Angola)' },
  { code: 'BRL', symbol: 'R$', name: 'Real (Brasil)' },
  { code: 'USD', symbol: 'US$', name: 'Dólar americano' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'MZN', symbol: 'MZN', name: 'Metical (Moçambique)' },
]

export const WITHDRAWAL_COUNTRIES: WithdrawalCountry[] = [
  {
    code: 'AO',
    name: 'Angola',
    flag: '🇦🇴',
    defaultCurrency: 'AOA',
    hint: 'IBAN angolano (AO06...) ou conta Multicaixa associada ao banco.',
  },
  {
    code: 'BR',
    name: 'Brasil',
    flag: '🇧🇷',
    defaultCurrency: 'BRL',
    hint: 'Informe banco, agência, conta e/ou chave PIX para receber em reais.',
  },
  {
    code: 'MZ',
    name: 'Moçambique',
    flag: '🇲🇿',
    defaultCurrency: 'MZN',
    hint: 'NIB ou IBAN moçambicano e nome do banco comercial.',
  },
]

export function getCountryByCode(code?: string | null): WithdrawalCountry | undefined {
  return WITHDRAWAL_COUNTRIES.find((c) => c.code === code)
}

/** Moeda definida automaticamente pelo país de levantamento. */
export function currencyForCountry(country?: string | null): CurrencyCode {
  return getCountryByCode(country)?.defaultCurrency ?? 'AOA'
}

export function resolveProfileCurrency(
  profile: Record<string, unknown> | null | undefined
): CurrencyCode {
  if (profile?.withdrawal_country) {
    return currencyForCountry(String(profile.withdrawal_country))
  }
  return (profile?.preferred_currency as CurrencyCode) || 'AOA'
}

export function getCurrencyOption(code?: string | null): CurrencyOption {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0]
}

export function formatMoney(amount: number, currencyCode?: string | null): string {
  const currency = getCurrencyOption(currencyCode)
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  return `${currency.symbol} ${safe.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function getBankFieldsForCountry(country: WithdrawalCountryCode): BankFieldConfig[] {
  switch (country) {
    case 'AO':
      return [
        { key: 'bank_account_name', label: 'Nome do titular', placeholder: 'Nome completo', required: true },
        { key: 'bank_name', label: 'Nome do banco', placeholder: 'Ex: BAI, BFA, Atlântico', required: true },
        {
          key: 'bank_account_number',
          label: 'IBAN / Nº de conta',
          placeholder: 'AO06 0000 0000 00000000000 00',
          required: true,
        },
      ]
    case 'BR':
      return [
        { key: 'bank_account_name', label: 'Nome completo do titular', placeholder: 'Como no banco', required: true },
        { key: 'bank_name', label: 'Banco', placeholder: 'Ex: Nubank, Itaú, Bradesco', required: true },
        { key: 'bank_branch', label: 'Agência', placeholder: '0001', required: true },
        { key: 'bank_account_number', label: 'Conta (com dígito)', placeholder: '12345-6', required: true },
        { key: 'bank_pix', label: 'Chave PIX (opcional)', placeholder: 'CPF, e-mail, telefone ou aleatória' },
      ]
    case 'MZ':
      return [
        { key: 'bank_account_name', label: 'Nome do titular', placeholder: 'Nome completo', required: true },
        { key: 'bank_name', label: 'Nome do banco', placeholder: 'Ex: BIM, BCI, Standard Bank', required: true },
        {
          key: 'bank_account_number',
          label: 'NIB / IBAN',
          placeholder: '00010000000000000000000',
          required: true,
        },
      ]
    default:
      return []
  }
}

export function bankDetailsFromProfile(profile: Record<string, unknown> | null): BankDetailsForm {
  return {
    bank_account_name: String(profile?.bank_account_name ?? ''),
    bank_name: String(profile?.bank_name ?? ''),
    bank_account_number: String(profile?.bank_account_number ?? ''),
    bank_branch: String(profile?.bank_branch ?? ''),
    bank_pix: String(profile?.bank_pix ?? ''),
  }
}

export function isBankDetailsComplete(
  country: WithdrawalCountryCode,
  details: BankDetailsForm
): boolean {
  const fields = getBankFieldsForCountry(country)
  return fields
    .filter((f) => f.required)
    .every((f) => details[f.key]?.trim().length > 0)
}

export function buildWithdrawalDescription(
  country: WithdrawalCountryCode,
  details: BankDetailsForm,
  currency: string
): string {
  const countryName = getCountryByCode(country)?.name ?? country
  const parts = [
    `Levantamento [${countryName}]`,
    `Titular: ${details.bank_account_name}`,
    `Banco: ${details.bank_name}`,
  ]
  if (details.bank_branch?.trim()) parts.push(`Agência: ${details.bank_branch}`)
  parts.push(`Conta/IBAN: ${details.bank_account_number}`)
  if (details.bank_pix?.trim()) parts.push(`PIX: ${details.bank_pix}`)
  parts.push(`Moeda: ${currency}`)
  return parts.join(' | ')
}

export function flutterwaveCurrency(currencyCode?: string | null): string {
  const map: Record<string, string> = {
    AOA: 'AOA',
    BRL: 'BRL',
    USD: 'USD',
    EUR: 'EUR',
    MZN: 'MZN',
  }
  return map[currencyCode || 'AOA'] || 'AOA'
}

export function minDepositForCurrency(currencyCode?: string | null): number {
  switch (currencyCode) {
    case 'USD':
    case 'EUR':
      return 1
    case 'BRL':
      return 10
    case 'MZN':
      return 100
    default:
      return 100
  }
}

export function getDepositPresets(currencyCode?: string | null): number[] {
  switch (currencyCode) {
    case 'BRL':
      return [50, 100, 200, 500]
    case 'USD':
    case 'EUR':
      return [10, 25, 50, 100]
    case 'MZN':
      return [500, 1000, 2500, 5000]
    default:
      return [1000, 2500, 5000, 10000]
  }
}

export function formatBankSummary(
  country: WithdrawalCountryCode,
  details: BankDetailsForm
): string[] {
  const lines: string[] = []
  const countryName = getCountryByCode(country)?.name ?? country
  lines.push(`País: ${countryName}`)
  if (details.bank_account_name) lines.push(`Titular: ${details.bank_account_name}`)
  if (details.bank_name) lines.push(`Banco: ${details.bank_name}`)
  if (details.bank_branch) lines.push(`Agência: ${details.bank_branch}`)
  if (details.bank_account_number) {
    const label = country === 'BR' ? 'Conta' : country === 'MZ' ? 'NIB/IBAN' : 'IBAN/Conta'
    lines.push(`${label}: ${details.bank_account_number}`)
  }
  if (details.bank_pix) lines.push(`PIX: ${details.bank_pix}`)
  return lines
}
