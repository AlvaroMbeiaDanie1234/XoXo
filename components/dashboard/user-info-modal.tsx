'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { User, Calendar, MapPin, Save, Loader2, X, Eye, EyeOff } from 'lucide-react'

interface UserInfoModalProps {
  userId: string | null
  onComplete?: () => void
}

// Lista de países com Angola destacada
const COUNTRIES = [
  { code: 'AO', name: 'Angola' },
  { code: 'BR', name: 'Brasil' },
  { code: 'PT', name: 'Portugal' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'UK', name: 'Reino Unido' },
  { code: 'MZ', name: 'Moçambique' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'GW', name: 'Guiné-Bissau' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'ST', name: 'São Tomé e Príncipe' },
  { code: 'FR', name: 'França' },
  { code: 'DE', name: 'Alemanha' },
  { code: 'ES', name: 'Espanha' },
  { code: 'IT', name: 'Itália' },
  { code: 'Other', name: 'Outro' },
]

// Províncias de Angola
const ANGOLA_PROVINCES = [
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cunene',
  'Huambo',
  'Huíla',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Namibe',
  'Zaire',
]

export default function UserInfoModal({ userId, onComplete }: UserInfoModalProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('')
  const [age, setAge] = useState('')
  const [country, setCountry] = useState('AO')
  const [province, setProvince] = useState('')
  const [location, setLocation] = useState('')
  
  // Opções de visibilidade
  const [showGender, setShowGender] = useState(true)
  const [showCountry, setShowCountry] = useState(true)
  const [showLocation, setShowLocation] = useState(true)
  
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    if (!userId) return

    // Verificar se o utilizador já completou as informações
    const checkUserInfo = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender, age, country, province, location, show_gender, show_country, show_location')
        .eq('id', userId)
        .single()

      // Se faltar informações obrigatórias, mostrar a modal
      // Província é obrigatória apenas para Angola
      const needsProvince = profile?.country === 'AO' && !profile?.province
      const needsInfo = !profile || !profile.gender || !profile.age || !profile.country || !profile.location || needsProvince
      
      if (needsInfo) {
        // Verificar localStorage para não mostrar repetidamente
        const dismissed = localStorage.getItem(`xoxo:user-info-completed:${userId}`)
        if (!dismissed) {
          setIsOpen(true)
        }
      }
    }

    checkUserInfo()
  }, [userId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!gender || !age || !country || !province || !location) {
      alert(t('userInfo.required'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          gender,
          age: parseInt(age),
          country,
          province,
          location,
          show_gender: showGender,
          show_country: showCountry,
          show_location: showLocation,
        })
        .eq('id', userId)

      if (error) throw error

      // Marcar como completado no localStorage
      localStorage.setItem(`xoxo:user-info-completed:${userId}`, '1')
      setIsOpen(false)
      onComplete?.()
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl bg-card p-6 animate-in fade-in zoom-in duration-300`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-xl font-bold text-foreground`}>
            {t('userInfo.title')}
          </h2>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`xoxo:user-info-completed:${userId}`, '1')
              setIsOpen(false)
            }}
            className={`p-2 rounded-full transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Gênero */}
          <div>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 text-foreground`}>
              <User size={16} />
              {t('userInfo.gender')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'other'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    gender === g
                      ? 'bg-accent text-white'
                      : 'bg-muted text-muted-foreground dark:text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {t(`userInfo.gender.${g}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Idade */}
          <div>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 text-foreground`}>
              <Calendar size={16} />
              {t('userInfo.age')}
            </label>
            <input
              type="number"
              min="18"
              max="100"
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all bg-muted border-border text-foreground placeholder-muted-foreground`}
            />
          </div>

          {/* País */}
          <div>
            <label className={`block text-sm font-semibold mb-2 flex items-center gap-2 text-foreground`}>
              <MapPin size={16} />
              {t('userInfo.country')}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all bg-muted border-border text-foreground`}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Província */}
          <div>
            <label className={`block text-sm font-semibold mb-2 text-foreground`}>
              {t('userInfo.province')}
            </label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              required
              disabled={country !== 'AO' && country !== 'Other'}
              className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all disabled:opacity-50 bg-muted border-border text-foreground`}
            >
              <option value="">Seleciona uma província</option>
              {country === 'AO' && ANGOLA_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {country === 'Other' && (
                <option value="Other">Outro</option>
              )}
            </select>
          </div>

          {/* Local de residência */}
          <div>
            <label className={`block text-sm font-semibold mb-2 text-foreground`}>
              {t('userInfo.location')}
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Cidade, bairro..."
              className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all bg-muted border-border text-foreground placeholder-muted-foreground`}
            />
          </div>

          {/* Seção de Visibilidade */}
          <div className={`mt-4 pt-4 border-t border-border`}>
            <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 text-foreground`}>
              {t('userInfo.visibility.title')}
            </h3>
            <p className={`text-xs mb-3 text-muted-foreground`}>
              {t('userInfo.visibility.hint')}
            </p>
            
            <div className="space-y-3">
              {/* Mostrar Gênero */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('userInfo.visibility.gender')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowGender(!showGender)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    showGender
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {showGender ? <Eye size={14} /> : <EyeOff size={14} />}
                  {showGender ? 'Visível' : 'Oculto'}
                </button>
              </div>

              {/* Mostrar País */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('userInfo.visibility.country')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCountry(!showCountry)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    showCountry
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {showCountry ? <Eye size={14} /> : <EyeOff size={14} />}
                  {showCountry ? 'Visível' : 'Oculto'}
                </button>
              </div>

              {/* Mostrar Local */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('userInfo.visibility.location')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowLocation(!showLocation)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    showLocation
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {showLocation ? <Eye size={14} /> : <EyeOff size={14} />}
                  {showLocation ? 'Visível' : 'Oculto'}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {loading ? t('userInfo.saving') : t('userInfo.save')}
          </button>
        </form>
      </div>
    </div>
  )
}