'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import {
  WITHDRAWAL_COUNTRIES,
  getBankFieldsForCountry,
  getCountryByCode,
  getCurrencyOption,
  currencyForCountry,
  bankDetailsFromProfile,
  type WithdrawalCountryCode,
  type BankDetailsForm,
} from '@/lib/wallet'
import { Globe, Building2, Save, Loader2, Info } from 'lucide-react'

interface WalletPreferencesProps {
  profile: Record<string, unknown> | null
  userId: string
  onSaved?: () => void
}

export default function WalletPreferences({ profile, userId, onSaved }: WalletPreferencesProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [saving, setSaving] = useState(false)

  const [country, setCountry] = useState<WithdrawalCountryCode>('AO')
  const [bank, setBank] = useState<BankDetailsForm>({
    bank_account_name: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    bank_pix: '',
  })

  useEffect(() => {
    if (!profile) return
    setCountry((profile.withdrawal_country as WithdrawalCountryCode) || 'AO')
    setBank(bankDetailsFromProfile(profile))
  }, [profile])

  const currency = currencyForCountry(country)
  const currencyOpt = getCurrencyOption(currency)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_currency: currency,
          withdrawal_country: country,
          bank_account_name: bank.bank_account_name.trim(),
          bank_name: bank.bank_name.trim(),
          bank_account_number: bank.bank_account_number.trim(),
          bank_branch: bank.bank_branch.trim() || null,
          bank_pix: bank.bank_pix.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) throw error
      window.dispatchEvent(new Event('profileUpdated'))
      alert('Dados de pagamento guardados com sucesso!')
      onSaved?.()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const bankFields = getBankFieldsForCountry(country)
  const countryInfo = getCountryByCode(country)

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className={`flex gap-3 rounded-xl border p-3 text-sm ${theme === 'dark' ? 'border-blue-900/70 bg-blue-950/30 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
        <Info className="flex-shrink-0 text-blue-600 mt-0.5" size={18} />
        <p>
          Os levantamentos serão creditados na conta bancária que indicares abaixo. Confirma que o
          nome do titular, banco e IBAN/conta estão corretos antes de guardar.
        </p>
      </div>

      <div className={`overflow-hidden rounded-2xl border shadow-sm ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-border bg-white'}`}>
        <div className={`border-b p-4 ${theme === 'dark' ? 'border-gray-700 bg-gray-900/40' : 'border-border bg-gray-50/60'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe className="text-accent" size={22} />
            País e moeda
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            A moeda da carteira, depósitos e levantamentos é definida automaticamente pelo país
            selecionado.
          </p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {WITHDRAWAL_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountry(c.code)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  country === c.code
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : theme === 'dark' ? 'border-gray-700 bg-gray-900 hover:border-accent/40' : 'border-border hover:border-accent/40'
                }`}
              >
                <span className="text-2xl">{c.flag}</span>
                <p className={`mt-2 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{c.name}</p>
                <p className="text-[10px] text-gray-500">Moeda: {c.defaultCurrency}</p>
              </button>
            ))}
          </div>
          <div className={`flex items-center justify-between rounded-lg border p-3 ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-border bg-gray-50'}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Moeda ativa
            </span>
            <span className="text-sm font-black text-accent">
              {currencyOpt.symbol} {currency} — {currencyOpt.name}
            </span>
          </div>
          {countryInfo && (
            <p className={`rounded-lg border p-3 text-xs ${theme === 'dark' ? 'border-gray-700 bg-gray-900 text-gray-300' : 'border-border bg-gray-50 text-gray-600'}`}>
              {countryInfo.hint}
            </p>
          )}
        </div>
      </div>

      <div className={`overflow-hidden rounded-2xl border shadow-sm ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-border bg-white'}`}>
        <div className={`border-b p-4 ${theme === 'dark' ? 'border-gray-700 bg-gray-900/40' : 'border-border bg-gray-50/60'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="text-orange-600" size={22} />
            Dados bancários para saque
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Conta onde receberás os levantamentos em {countryInfo?.name ?? 'país selecionado'}.
          </p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {bankFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={bank[field.key]}
                  onChange={(e) => setBank((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-accent ${theme === 'dark' ? 'border-gray-700 bg-gray-950 text-white' : 'border-border bg-gray-50 text-gray-900'}`}
                />
              ) : (
                <input
                  type="text"
                  value={bank[field.key]}
                  onChange={(e) => setBank((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-accent ${theme === 'dark' ? 'border-gray-700 bg-gray-950 text-white' : 'border-border bg-gray-50 text-gray-900'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-bold text-white shadow-lg hover:bg-accent/90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
        Guardar país e dados bancários
      </button>
    </form>
  )
}
