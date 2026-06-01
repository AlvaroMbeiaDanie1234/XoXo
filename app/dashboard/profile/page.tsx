'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { Camera, Save, Loader2, User as UserIcon, Phone, FileText, CheckCircle, ShieldCheck, Star, Link2, Copy, Users, Globe, MapPin, Crown, Trash2, Image, Video, MessageCircle, Heart, Eye, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import { buildReferralCode } from '@/lib/referrals'
import { useTheme } from 'next-themes'
import { isAdminEmail } from '@/lib/admin-emails'

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
  const [myPosts, setMyPosts] = useState<any[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [stats, setStats] = useState({ posts: 0, likes: 0, comments: 0, views: 0, earnings: 0 })

  // Form fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [smsEnabled, setSmsEnabled] = useState(true)
  
  // User info fields
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('')
  const [age, setAge] = useState('')
  const [country, setCountry] = useState('AO')
  const [province, setProvince] = useState('')
  const [location, setLocation] = useState('')
  const [showGender, setShowGender] = useState(true)
  const [showCountry, setShowCountry] = useState(true)
  const [showLocation, setShowLocation] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()
  const { theme } = useTheme()

  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      loadMyPosts(user.id)
      loadStats(user.id)
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
        
        // Load user info fields
        setGender(profileData.gender || '')
        setAge(profileData.age ? String(profileData.age) : '')
        setCountry(profileData.country || 'AO')
        setProvince(profileData.province || '')
        setLocation(profileData.location || '')
        setShowGender(profileData.show_gender !== false)
        setShowCountry(profileData.show_country !== false)
        setShowLocation(profileData.show_location !== false)

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
          gender: gender || null,
          age: age ? parseInt(age, 10) : null,
          country: country || null,
          province: province || null,
          location: location || null,
          show_gender: showGender,
          show_country: showCountry,
          show_location: showLocation,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) throw updateError

      setProfile(updatedProfile)
      setIsEditing(false)
      alert('Perfil atualizado com sucesso!')
      window.dispatchEvent(new Event('profileUpdated'))
      router.refresh()
      
    } catch (err: any) {
      console.error(err)
      alert('Erro ao guardar perfil: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const loadMyPosts = async (userId: string) => {
    const { data: posts } = await supabase
      .from('posts')
      .select('id, title, content_type, created_at, content_url, thumbnail_url, is_free, price')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!posts) { setLoadingPosts(false); return }

    const ids = posts.map(p => p.id)

    const likesPerPost: Record<string, number> = {}
    const commentsPerPost: Record<string, number> = {}
    const viewsPerPost: Record<string, number> = {}

    const [{ data: likesData }, { data: commentsData }, { data: viewsData }] = await Promise.all([
      supabase.from('likes').select('post_id').in('post_id', ids),
      supabase.from('comments').select('post_id').in('post_id', ids),
      supabase.from('post_views').select('post_id').in('post_id', ids),
    ])

    if (likesData) for (const l of likesData) likesPerPost[l.post_id] = (likesPerPost[l.post_id] || 0) + 1
    if (commentsData) for (const c of commentsData) commentsPerPost[c.post_id] = (commentsPerPost[c.post_id] || 0) + 1
    if (viewsData) for (const v of viewsData) viewsPerPost[v.post_id] = (viewsPerPost[v.post_id] || 0) + 1

    const postsWithStats = posts.map(p => ({
      ...p,
      likes_count: likesPerPost[p.id] || 0,
      comments_count: commentsPerPost[p.id] || 0,
      views_count: viewsPerPost[p.id] || 0,
    }))

    setMyPosts(postsWithStats)
    setLoadingPosts(false)
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tens a certeza que desejas eliminar esta publicação permanentemente?')) return
    setDeletingPostId(postId)
    try {
      await Promise.all([
        supabase.from('likes').delete().eq('post_id', postId),
        supabase.from('comments').delete().eq('post_id', postId),
        supabase.from('favorites').delete().eq('post_id', postId),
      ])
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      setMyPosts(prev => prev.filter(p => p.id !== postId))
      setStats(prev => ({ ...prev, posts: prev.posts - 1 }))
    } catch (err: any) {
      console.error(err)
      alert('Erro ao eliminar publicação: ' + err.message)
    } finally {
      setDeletingPostId(null)
    }
  }

  const loadStats = async (userId: string) => {
    const { count: postCount } = await supabase
      .from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId)

    const { data: postIds } = await supabase
      .from('posts').select('id').eq('user_id', userId)

    let likesTotal = 0
    let commentsTotal = 0
    let viewsTotal = 0

    if (postIds && postIds.length > 0) {
      const ids = postIds.map(p => p.id)
      const { count: likesCount } = await supabase
        .from('likes').select('*', { count: 'exact', head: true }).in('post_id', ids)
      likesTotal = likesCount ?? 0

      const { count: commentsCount } = await supabase
        .from('comments').select('*', { count: 'exact', head: true }).in('post_id', ids)
      commentsTotal = commentsCount ?? 0

      const { count: viewsCount } = await supabase
        .from('post_views').select('*', { count: 'exact', head: true }).in('post_id', ids)
      viewsTotal = viewsCount ?? 0
    }

    const { data: earningsData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'earnings')
      .eq('status', 'completed')

    const earningsTotal = earningsData?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0

    setStats({
      posts: postCount ?? 0,
      likes: likesTotal,
      comments: commentsTotal,
      views: viewsTotal,
      earnings: earningsTotal,
    })
  }

  if (loading) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-background'}`}>
        <Header user={user} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen pb-12 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-[#f3f2ef]'}`}>
      <Header user={user} />

      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content (Center) */}
        <div className="flex-1 max-w-[550px] w-full">
          <div className={`rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
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
                
                <h1 className={`text-2xl font-black flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {profile?.display_name || user?.email?.split('@')[0]}
                  {user?.email && isAdminEmail(user.email) && (
                    <Crown size={24} className="text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  )}
                  {!(user?.email && isAdminEmail(user.email)) && profile?.is_verified && <CheckCircle size={20} className="text-blue-500 fill-blue-500" />}
                </h1>

                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
                {profile?.phone && <p className={`text-xs mt-1 flex items-center justify-center gap-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}><Phone size={12}/> {profile.phone}</p>}

                <div className={`mt-6 p-4 rounded-xl border text-left ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                   <p className={`text-sm whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                     {profile?.bio || <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Sem biografia. Adiciona uma descrição para que as pessoas te conheçam melhor.</span>}
                   </p>
                 </div>

                 {/* User Info Display - View Mode */}
                 <div className="mt-4 flex flex-wrap gap-2 justify-center">
                   {profile?.show_gender && profile?.gender && (
                     <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                       <UserIcon size={12} />
                       {profile.gender === 'male' ? 'Masculino' : profile.gender === 'female' ? 'Feminino' : 'Outro'}
                     </span>
                   )}
                   {profile?.show_country && profile?.country && (
                     <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                       <Globe size={12} />
                       {profile.country === 'AO' ? 'Angola' : profile.country === 'PT' ? 'Portugal' : profile.country === 'BR' ? 'Brasil' : profile.country === 'US' ? 'Estados Unidos' : profile.country === 'UK' ? 'Reino Unido' : profile.country}
                     </span>
                   )}
                   {profile?.show_location && profile?.location && (
                     <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                       <MapPin size={12} />
                       {profile.location}
                     </span>
                   )}
                 </div>

                 {/* Referral Link Card */}
                <div className={`mt-4 p-4 rounded-xl border text-left ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'border-accent/20 bg-gradient-to-br from-accent/5 to-purple-50'}`}>
                  <p className={`text-sm font-bold flex items-center gap-2 mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <Link2 size={15} className="text-accent" /> Link de Referência
                  </p>
                  <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Partilha este link. Quando alguém se registar e ativar a conta, recebes{' '}
                    <strong className="text-accent">AOA {Number(referralBonusAmount).toLocaleString()}</strong> no teu saldo.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className={`flex-1 px-3 py-2 text-xs border rounded-lg font-mono truncate ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-white border-border text-gray-600'}`}
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
                  <p className={`text-[10px] mt-2 flex items-center gap-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                    <Users size={12} /> {referralCount} {referralCount === 1 ? 'pessoa referida' : 'pessoas referidas'}
                  </p>
                </div>

                {/* SMS Status Card */}
                <div className={`mt-4 p-4 rounded-xl border text-left ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-border'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        <Phone size={15} className="text-accent" /> Notificações SMS
                      </p>
                      {!profile?.phone ? (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          ⚠️ Sem número de telefone. Edita o teu perfil para receber SMS.
                        </p>
                      ) : (
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {profile?.sms_notifications_enabled !== false
                            ? `SMS ativos para ${profile.phone}`
                            : 'Notificações SMS desativadas por si.'}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${profile?.sms_notifications_enabled !== false && profile?.phone ? 'bg-green-100 text-green-700' : theme === 'dark' ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
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
                    <label className={`block text-sm font-semibold mb-1.5 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      <UserIcon size={16} className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} /> 
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="O teu nome ou pseudónimo"
                      className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold mb-1.5 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      <Phone size={16} className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} /> 
                      Número de Telefone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-gray-300'}`}
                    />
                  </div>

                  <div>
                     <label className={`block text-sm font-semibold mb-1.5 flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                       <FileText size={16} className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} /> 
                       Descrição / Bio
                     </label>
                     <textarea
                       rows={4}
                       value={bio}
                       onChange={(e) => setBio(e.target.value)}
                       placeholder="Ex: Fodedor, Safado, Criador Premium..."
                       className={`w-full px-4 py-2.5 rounded-lg border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-gray-300'}`}
                     />
                   </div>

                   {/* User Info Section */}
                   <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-border'}`}>
                     <p className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                       <UserIcon size={16} className="text-accent" /> Informações Pessoais
                     </p>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {/* Gender */}
                       <div>
                         <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                           Gênero
                         </label>
                         <select
                           value={gender}
                           onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other' | '')}
                           className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}`}
                         >
                           <option value="">Selecionar...</option>
                           <option value="male">Masculino</option>
                           <option value="female">Feminino</option>
                           <option value="other">Outro</option>
                         </select>
                       </div>

                       {/* Age */}
                       <div>
                         <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                           Idade
                         </label>
                         <input
                           type="number"
                           min="18"
                           max="100"
                           value={age}
                           onChange={(e) => setAge(e.target.value)}
                           placeholder="18-100"
                           className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-500' : 'border-gray-300'}`}
                         />
                       </div>

                       {/* Country */}
                       <div>
                         <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                           País
                         </label>
                         <select
                           value={country}
                           onChange={(e) => {
                             setCountry(e.target.value)
                             if (e.target.value !== 'AO') setProvince('')
                           }}
                           className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}`}
                         >
                           <option value="AO">Angola</option>
                           <option value="PT">Portugal</option>
                           <option value="BR">Brasil</option>
                           <option value="US">Estados Unidos</option>
                           <option value="UK">Reino Unido</option>
                           <option value="Other">Outro</option>
                         </select>
                       </div>

                       {/* Province (only for Angola) */}
                       {country === 'AO' && (
                         <div>
                           <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                             Província
                           </label>
                           <select
                             value={province}
                             onChange={(e) => setProvince(e.target.value)}
                             className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}`}
                           >
                             <option value="">Selecionar província...</option>
                             <option value="Luanda">Luanda</option>
                             <option value="Bengo">Bengo</option>
                             <option value="Benguela">Benguela</option>
                             <option value="Huambo">Huambo</option>
                             <option value="Lubango">Lubango</option>
                             <option value="Cabinda">Cabinda</option>
                             <option value="Kuando Kubango">Kuando Kubango</option>
                             <option value="Cunene">Cunene</option>
                             <option value="Namibe">Namibe</option>
                             <option value="Huíla">Huíla</option>
                             <option value="Bié">Bié</option>
                             <option value="Moxico">Moxico</option>
                             <option value="Zaire">Zaire</option>
                             <option value="Cuanza Norte">Cuanza Norte</option>
                             <option value="Cuanza Sul">Cuanza Sul</option>
                             <option value="Malanje">Malanje</option>
                             <option value="Uíge">Uíge</option>
                             <option value="Cuanza">Cuanza</option>
                           </select>
                         </div>
                       )}

                       {/* Location */}
                       <div className="sm:col-span-2">
                         <label className={`block text-xs font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                           Localidade / Cidade
                         </label>
                         <input
                           type="text"
                           value={location}
                           onChange={(e) => setLocation(e.target.value)}
                           placeholder="Ex: Luanda, Benguela, Huambo..."
                           className={`w-full px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-500' : 'border-gray-300'}`}
                         />
                       </div>
                     </div>

                     {/* Visibility Toggles */}
                     <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                       <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                         Visibilidade no Perfil
                       </p>
                       <div className="flex flex-wrap gap-3">
                         <label className="flex items-center gap-2 cursor-pointer">
                           <input
                             type="checkbox"
                             checked={showGender}
                             onChange={(e) => setShowGender(e.target.checked)}
                             className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                           />
                           <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Mostrar Gênero</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                           <input
                             type="checkbox"
                             checked={showCountry}
                             onChange={(e) => setShowCountry(e.target.checked)}
                             className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                           />
                           <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Mostrar País</span>
                         </label>
                         <label className="flex items-center gap-2 cursor-pointer">
                           <input
                             type="checkbox"
                             checked={showLocation}
                             onChange={(e) => setShowLocation(e.target.checked)}
                             className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                           />
                           <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Mostrar Localidade</span>
                         </label>
                       </div>
                     </div>
                   </div>

                   {/* SMS Opt-in Toggle */}
                   <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-border'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                          <Phone size={15} className="text-accent" /> Notificações SMS
                        </p>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {phone
                            ? 'Receba SMS sobre compras, levantamentos e pagamentos.'
                            : '⚠️ Adicione um número de telefone acima para ativar SMS.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSmsEnabled(prev => !prev)}
                        disabled={!phone}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-40 ${smsEnabled && phone ? 'bg-accent' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`}
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
                       // Revert user info fields
                       setGender(profile?.gender || '')
                       setAge(profile?.age ? String(profile.age) : '')
                       setCountry(profile?.country || 'AO')
                       setProvince(profile?.province || '')
                       setLocation(profile?.location || '')
                       setShowGender(profile?.show_gender !== false)
                       setShowCountry(profile?.show_country !== false)
                       setShowLocation(profile?.show_location !== false)
                     }}
                    disabled={saving}
                    className={`px-6 py-3 rounded-full font-bold transition-colors w-full sm:w-auto ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
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

          {/* Creator Stats */}
          {!isEditing && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Publicacoes', value: stats.posts, icon: BarChart3, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
              { label: 'Reacoes', value: stats.likes, icon: Heart, color: 'from-red-500 to-red-600', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400' },
              { label: 'Comentarios', value: stats.comments, icon: MessageCircle, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-600 dark:text-purple-400' },
              { label: 'Visualizacoes', value: stats.views, icon: Eye, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Ganhos (AOA)', value: stats.earnings.toLocaleString(), icon: DollarSign, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border shadow-sm p-3 sm:p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                <div className="flex items-center gap-2 sm:gap-3 lg:flex-col lg:text-center">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 ${item.text}`}>
                    <item.icon size={16} className="sm:size-5" />
                  </div>
                  <div className="min-w-0 lg:w-full">
                    <p className={`text-base sm:text-lg font-black truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
                    <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Meus Conteudos */}
          {!isEditing && (
          <div className={`mt-6 rounded-xl border shadow-sm overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-lg">Meus Conteudos</h2>
              <span className="text-xs text-gray-400 font-semibold">{myPosts.length} publicacoes</span>
            </div>
            {loadingPosts ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" size={24} /></div>
            ) : myPosts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhum conteudo publicado ainda.</div>
            ) : (
              <div className="divide-y divide-border">
                {myPosts.map((post) => {
                  const engagement = post.views_count > 0 ? ((post.likes_count + post.comments_count) / post.views_count) * 100 : 0
                  const isPositive = engagement >= 5
                  return (
                  <div key={post.id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {post.content_type === 'video' ? (
                          post.thumbnail_url ? <img src={post.thumbnail_url} className="w-full h-full object-cover" /> : <Video size={20} className="text-gray-400" />
                        ) : post.content_type === 'photo' ? (
                          post.thumbnail_url ? <img src={post.thumbnail_url} className="w-full h-full object-cover" /> : <Image size={20} className="text-gray-400" />
                        ) : (
                          <FileText size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{post.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold uppercase">
                          <span>{post.content_type}</span>
                          {!post.is_free && <span className="text-accent">Pago</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPostId === post.id}
                        className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                          deletingPostId === post.id
                            ? 'text-gray-300'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                        }`}
                      >
                        {deletingPostId === post.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Heart size={12} className="text-red-400" /> {post.likes_count}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <MessageCircle size={12} className="text-blue-400" /> {post.comments_count}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Eye size={12} className="text-emerald-400" /> {post.views_count}
                      </span>
                      <span className={`flex items-center gap-1 font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {post.views_count > 0 ? (
                          <>{isPositive ? '▲' : '▼'} {engagement.toFixed(1)}%</>
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )}
                        <span className="text-[10px] font-normal text-gray-400">eng.</span>
                      </span>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
          )}

          {/* VIP Badge Card — visible on mobile/tablet below form */}
          {!(user?.email && isAdminEmail(user.email)) && (
            <div className="xl:hidden mt-6">
              <VipBadgeCard
                profile={profile}
                vipBadgePrice={vipBadgePrice}
                requestingBadge={requestingBadge}
                theme={theme}
                onBuy={handleBuyBadge}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar (Verification Box) — visible on desktop */}
        <div className="hidden xl:block w-[280px] flex-shrink-0">
          {!(user?.email && isAdminEmail(user.email)) && (
            <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden sticky top-24 p-5">
              <VipBadgeCard
                profile={profile}
                vipBadgePrice={vipBadgePrice}
                requestingBadge={requestingBadge}
                theme={theme}
                onBuy={handleBuyBadge}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VipBadgeCard({ profile, vipBadgePrice, requestingBadge, theme, onBuy }: {
  profile: any
  vipBadgePrice: string
  requestingBadge: boolean
  theme: string | undefined
  onBuy: () => void
}) {
  return (
    <>
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
        onClick={onBuy}
        disabled={requestingBadge || profile?.is_verified}
        className={`w-full py-3 rounded-xl font-bold transition-all shadow-md text-sm flex items-center justify-center gap-2 ${
          profile?.is_verified
          ? 'bg-blue-50 text-blue-600 cursor-default shadow-none border border-blue-100'
          : 'bg-gradient-to-r from-accent to-blue-600 hover:from-accent hover:to-blue-700 text-white active:scale-95'
        }`}
      >
        {profile?.is_verified ? (
          <><CheckCircle size={16} className="fill-blue-600 text-white" /> Verificado</>
        ) : requestingBadge ? (
          <><Loader2 size={16} className="animate-spin" /> Processando...</>
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
    </>
  )
}
