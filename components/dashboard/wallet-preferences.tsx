'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    <form onSubmit={handleSave} className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 text-sm text-blue-900">
        <Info className="flex-shrink-0 text-blue-600 mt-0.5" size={18} />
        <p>
          Os levantamentos serão creditados na conta bancária que indicares abaixo. Confirma que o
          nome do titular, banco e IBAN/conta estão corretos antes de guardar.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe className="text-accent" size={22} />
            País e moeda
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            A moeda da carteira, depósitos e levantamentos é definida automaticamente pelo país
            selecionado.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {WITHDRAWAL_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountry(c.code)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  country === c.code
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <span className="text-2xl">{c.flag}</span>
                <p className="text-sm font-bold text-gray-900 mt-2">{c.name}</p>
                <p className="text-[10px] text-gray-500">Moeda: {c.defaultCurrency}</p>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-border rounded-lg">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Moeda ativa
            </span>
            <span className="text-sm font-black text-accent">
              {currencyOpt.symbol} {currency} — {currencyOpt.name}
            </span>
          </div>
          {countryInfo && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-border rounded-lg p-3">
              {countryInfo.hint}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="text-orange-600" size={22} />
            Dados bancários para saque
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Conta onde receberás os levantamentos em {countryInfo?.name ?? 'país selecionado'}.
          </p>
        </div>
        <div className="p-6 space-y-4">
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
                  className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 outline-none focus:border-accent text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={bank[field.key]}
                  onChange={(e) => setBank((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 outline-none focus:border-accent text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
      >
        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
        Guardar país e dados bancários
      </button>
    </form>
  )
}
