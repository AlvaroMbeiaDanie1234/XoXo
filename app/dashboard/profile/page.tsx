'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { Camera, Save, Loader2, User as UserIcon, Phone, FileText, CheckCircle, ShieldCheck, Star, Link2, Copy, Users } from 'lucide-react'
import { buildReferralCode } from '@/lib/referrals'

export default function EditProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [requestingBadge, setRequestingBadge] = useState(false)
  const [vipBadgePrice, setVipBadgePrice] = useState('15000') // Default
  const [referralBonusAmount, setReferralBonusAmount] = useState('5000')
  const [referralCount, setReferralCount] = useState(0)
  const [referralLink, setReferralLink] = useState('')
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [balance, setBalance] = useState(0)
  
  // Form fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [smsEnabled, setSmsEnabled] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (!profileData) {
        // Create default profile if missing
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: user.email?.split('@')[0],
            email: user.email,
            referral_code: buildReferralCode(user.id),
          })
          .select()
          .single()
        
        if (!createError) profileData = newProfile
      }

      if (profileData) {
        let code = profileData.referral_code
        if (!code) {
          code = buildReferralCode(user.id)
          await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)
          profileData = { ...profileData, referral_code: code }
        }

        setProfile(profileData)
        setBalance(profileData.balance || 0)
        setDisplayName(profileData.display_name || '')
        setBio(profileData.bio || '')
        setPhone(profileData.phone || '')
        setSmsEnabled(profileData.sms_notifications_enabled !== false) // default true
        setAvatarPreview(profileData.avatar_url || null)

        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        setReferralLink(`${origin}/auth/sign-up?ref=${code}`)

        const { count } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', user.id)
        setReferralCount(count ?? 0)
      }

      const { data: settingsRows } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['vip_badge_price', 'referral_bonus_amount'])

      if (settingsRows) {
        const badgeSetting = settingsRows.find(s => s.key === 'vip_badge_price')
        if (badgeSetting) setVipBadgePrice(badgeSetting.value)

        const referralSetting = settingsRows.find(s => s.key === 'referral_bonus_amount')
        if (referralSetting) setReferralBonusAmount(referralSetting.value)
      }
      
      setLoading(false)
    }
    
    loadProfile()
  }, [supabase, router])

  const handleCopyReferralLink = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedReferral(true)
      setTimeout(() => setCopiedReferral(false), 2000)
    } catch {
      alert('Não foi possível copiar o link. Copia manualmente: ' + referralLink)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('A foto deve ter menos de 10MB.')
        return
      }
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleBuyBadge = async () => {
    const isFreePlan = !!profile?.is_free_plan
    const price = isFreePlan ? 0 : Number(vipBadgePrice)
    if (!isFreePlan && balance < price) {
      alert(`Saldo insuficiente! Precisas de AOA ${price.toLocaleString()} para comprar o selo VIP. O teu saldo atual é AOA ${balance.toLocaleString()}. Podes carregar a tua carteira no menu Saldo.`)
      return
    }

    const confirmMsg = isFreePlan
      ? "Desejas ativar o Selo VIP Oficial gratuitamente?"
      : `Confirmas a compra do Selo VIP por AOA ${price.toLocaleString()}? O valor será descontado do teu saldo.`

    if (!confirm(confirmMsg)) return

    setRequestingBadge(true)
    try {
      // 1. Inserir transação de compra se não for plano grátis
      if (!isFreePlan) {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount: price,
          type: 'purchase',
          description: 'Compra de Selo VIP Oficial',
          status: 'completed'
        })

        if (txError) throw txError
      } else {
        // Se for plano grátis, cria transação informativa de valor 0
        const { error: freeTxError } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount: 0,
          type: 'purchase',
          description: 'Selo VIP Ativado Gratuitamente (Plano Grátis)',
          status: 'completed'
        })
        if (freeTxError) {
          console.error('Erro ao registar transação gratuita:', freeTxError)
        }
      }

      // 2. Atualizar perfil para verificado
      const { error: verifyError } = await supabase.from('profiles').update({ is_verified: true }).eq('id', user.id)
      if (verifyError) throw verifyError

      // 3. Atualizar estado local
      setProfile({ ...profile, is_verified: true })
      if (!isFreePlan) {
        setBalance(balance - price)
      }
      
      alert(isFreePlan ? 'Selo VIP Oficial ativado gratuitamente!' : 'Parabéns! Adquiriste o Selo VIP Oficial com sucesso. O teu perfil está agora destacado!')
    } catch (err: any) {
      alert('Erro ao processar compra: ' + err.message)
    } finally {
      setRequestingBadge(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let finalAvatarUrl = profile?.avatar_url || ''

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `avatar_${user.id}_${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const res = await fetch('/api/storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath })
        })
        
        const { data: signedData, error: signedError } = await res.json()
        if (signedError || !signedData) throw new Error("Falha ao gerar permissão de upload para avatar.")

        const { error: uploadError } = await supabase.storage
          .from('media')
          .uploadToSignedUrl(filePath, signedData.token, avatarFile)

        if (uploadError) throw new Error("Erro ao fazer upload da foto de perfil.")

        const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath)
        finalAvatarUrl = publicUrlData.publicUrl
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          bio: bio,
          phone: phone,
          avatar_url: finalAvatarUrl,
          sms_notifications_enabled: smsEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      setProfile(updatedProfile)
      setIsEditing(false)
      alert('Perfil atualizado com sucesso!')
      router.refresh()
      
    } catch (err: any) {
      console.error(err)
      alert('Erro ao guardar perfil: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] pb-12">
      <Header user={user} />

      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content (Center) */}
        <div className="flex-1 max-w-[550px] w-full">
          <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            {/* Header / Cover */}
            <div className="h-32 bg-gradient-to-r from-accent to-purple-600 relative" />
            
            {!isEditing ? (
              // Modo Visualização
              <div className="px-6 sm:px-8 pb-8 -mt-12 relative z-10 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-28 h-28 rounded-full border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center bg-gray-100 relative">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={48} className="text-gray-300" />
                    )}
                  </div>
                </div>
                
                <h1 className="text-2xl font-black text-gray-900 flex items-center justify-center gap-2">
                  {profile?.display_name || user?.email?.split('@')[0]}
                  {profile?.is_verified && <CheckCircle size={20} className="text-blue-500 fill-blue-500" />}
                </h1>
                
                <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
                {profile?.phone && <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1"><Phone size={12}/> {profile.phone}</p>}
                
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-left">
                   <p className="text-sm text-gray-700 whitespace-pre-wrap">
                     {profile?.bio || <span className="text-gray-400 italic">Sem biografia. Adiciona uma descrição para que as pessoas te conheçam melhor.</span>}
                   </p>
                </div>

                {/* Referral Link Card */}
                <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-purple-50 text-left">
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2">
                    <Link2 size={15} className="text-accent" /> Link de Referência
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Partilha este link. Quando alguém se registar e ativar a conta, recebes{' '}
                    <strong className="text-accent">AOA {Number(referralBonusAmount).toLocaleString()}</strong> no teu saldo.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-border rounded-lg font-mono text-gray-600 truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyReferralLink}
                      className="px-3 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors"
                    >
                      <Copy size={14} />
                      {copiedReferral ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                    <Users size={12} /> {referralCount} {referralCount === 1 ? 'pessoa referida' : 'pessoas referidas'}
                  </p>
                </div>

                {/* SMS Status Card */}
                <div className="mt-4 p-4 rounded-xl border border-border bg-gray-50 text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Phone size={15} className="text-accent" /> Notificações SMS
                      </p>
                      {!profile?.phone ? (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          ⚠️ Sem número de telefone. Edita o teu perfil para receber SMS.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          {profile?.sms_notifications_enabled !== false
                            ? `SMS ativos para ${profile.phone}`
                            : 'Notificações SMS desativadas por si.'}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${profile?.sms_notifications_enabled !== false && profile?.phone ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {profile?.sms_notifications_enabled !== false && profile?.phone ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-full font-bold transition-all duration-300 shadow-md inline-block w-full sm:w-auto"
                  >
                    Editar Perfil
                  </button>
                </div>
              </div>
            ) : (
              // Modo Edição
              <form onSubmit={handleSave} className="px-6 sm:px-8 pb-8 -mt-12 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                {/* Avatar Upload Area */}
                <div className="flex justify-center mb-8">
                  <div className="relative group cursor-pointer">
                    <div className="w-28 h-28 rounded-full border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center bg-gray-100 relative">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={48} className="text-gray-300" />
                      )}
                      
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Camera size={24} className="text-white mb-1" />
                        <span className="text-white text-xs font-semibold">Alterar Foto</span>
                      </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                      <UserIcon size={16} className="text-gray-400" /> 
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="O teu nome ou pseudónimo"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" /> 
                      Número de Telefone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" /> 
                      Descrição / Bio
                    </label>
                    <textarea
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ex: Fodedor, Safado, Criador Premium..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none"
                    />
                  </div>

                  {/* SMS Opt-in Toggle */}
                  <div className="p-4 rounded-xl border border-border bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <Phone size={15} className="text-accent" /> Notificações SMS
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {phone
                            ? 'Receba SMS sobre compras, levantamentos e pagamentos.'
                            : '⚠️ Adicione um número de telefone acima para ativar SMS.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSmsEnabled(prev => !prev)}
                        disabled={!phone}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-40 ${smsEnabled && phone ? 'bg-accent' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${smsEnabled && phone ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      // Revert fields
                      setDisplayName(profile?.display_name || '')
                      setBio(profile?.bio || '')
                      setPhone(profile?.phone || '')
                      setSmsEnabled(profile?.sms_notifications_enabled !== false)
                      setAvatarPreview(profile?.avatar_url || null)
                    }}
                    disabled={saving}
                    className="px-6 py-3 rounded-full font-bold text-gray-600 hover:bg-gray-100 transition-colors w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-full font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-md disabled:opacity-70 w-full sm:w-auto"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar Alterações
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Sidebar (Verification Box) */}
        <div className="hidden xl:block w-[280px] flex-shrink-0">
          <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden sticky top-24 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <CheckCircle size={20} className="text-blue-500 fill-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 leading-tight text-sm">Selo VIP Oficial</h3>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Destaque-se</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Receba o selo azul, prioridade nas buscas e 5x mais visibilidade na rede.
            </p>

            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                 <ShieldCheck size={14} className="text-blue-500" /> Autenticidade garantida
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                 <Star size={14} className="text-blue-500" /> Maior alcance
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-5 border border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500 font-bold">Preço</span>
              <span className="font-black text-accent">
                {profile?.is_free_plan ? 'Grátis 🌟' : `AOA ${Number(vipBadgePrice).toLocaleString()}`}
              </span>
            </div>

            <button
              onClick={handleBuyBadge}
              disabled={requestingBadge || profile?.is_verified}
              className={`w-full py-3 rounded-xl font-bold transition-all shadow-md text-sm flex items-center justify-center gap-2 ${
                profile?.is_verified 
                ? 'bg-blue-50 text-blue-600 cursor-default shadow-none border border-blue-100' 
                : 'bg-gradient-to-r from-accent to-blue-600 hover:from-accent hover:to-blue-700 text-white active:scale-95'
              }`}
            >
              {profile?.is_verified ? (
                <>
                  <CheckCircle size={16} className="fill-blue-600 text-white" /> Verificado
                </>
              ) : requestingBadge ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processando...
                </>
              ) : profile?.is_free_plan ? (
                'Ativar Selo Grátis'
              ) : (
                'Comprar Selo'
              )}
            </button>
            
            {!profile?.is_verified && (
               <p className="text-[9px] text-center text-gray-400 mt-3 font-medium">
                 {profile?.is_free_plan 
                   ? 'Plano Grátis ativo. Não haverá qualquer custo.' 
                   : 'O valor será descontado do seu Saldo Disponível.'}
               </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
