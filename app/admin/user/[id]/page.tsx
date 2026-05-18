'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import { 
  Users, Shield, Calendar, Mail, Phone, MapPin, 
  Trash2, Eye, CheckCircle, XCircle, Loader2, ArrowLeft,
  FileText, Video as VideoIcon, Image as ImageIcon, DollarSign, Play,
  PlusCircle
} from 'lucide-react'

export default function AdminUserDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDescription, setCreditDescription] = useState('')
  const [crediting, setCrediting] = useState(false)
  const [updatingPlan, setUpdatingPlan] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleToggleFreePlan = async () => {
    setUpdatingPlan(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_free_plan: !profile.is_free_plan })
        .eq('id', id)
      
      if (error) throw error

      setProfile((prev: any) => ({ ...prev, is_free_plan: !prev.is_free_plan }))
      alert(!profile.is_free_plan ? 'Plano Grátis atribuído com sucesso!' : 'Plano Grátis removido com sucesso!')
    } catch (err: any) {
      alert('Erro ao atualizar plano: ' + err.message)
    } finally {
      setUpdatingPlan(false)
    }
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || (user.email !== 'admin.xoxo@gmail.com' && user.email !== 'superadmin.xoxo@gmail.com')) {
        router.push('/')
        return
      }
      setCurrentUser(user)

      // Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      
      if (profileData) setProfile(profileData)

      // Fetch User Posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      
      if (postsData) setPosts(postsData)

      setLoading(false)
    }

    loadData()
  }, [id, supabase, router])

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Deseja realmente remover esta publicação?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) alert('Erro: ' + error.message)
    else setPosts(posts.filter(p => p.id !== postId))
  }

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditAmount || parseFloat(creditAmount) <= 0) return

    setCrediting(true)
    try {
      const amount = parseFloat(creditAmount)
      const { error } = await supabase.from('transactions').insert({
        user_id: id,
        amount: amount,
        type: 'deposit',
        status: 'completed',
        description: creditDescription || 'Carregamento administrativo de saldo'
      })

      if (error) throw error

      // Reload user profile to show updated balance
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', id)
        .single()

      if (updatedProfile) {
        setProfile((prev: any) => ({ ...prev, balance: updatedProfile.balance }))
      }

      alert(`Saldo carregado com sucesso! Adicionado AOA ${amount.toLocaleString()} à conta de ${profile.display_name}.`)
      setCreditAmount('')
      setCreditDescription('')
    } catch (err: any) {
      alert('Erro ao carregar saldo: ' + err.message)
    } finally {
      setCrediting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={currentUser} />
        <div className="flex items-center justify-center pt-32"><Loader2 className="animate-spin text-accent" /></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={currentUser} />
        <div className="text-center pt-32">Utilizador não encontrado.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header user={currentUser} />

      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={20} /> Voltar ao Painel
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-accent to-purple-600"></div>
              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-lg">
                    <div className="w-full h-full rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={40} className="text-gray-300" />
                      )}
                    </div>
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {profile.display_name}
                  {profile.is_verified && <CheckCircle size={20} className="text-blue-500 fill-blue-500" />}
                </h1>
                <p className="text-gray-500 text-sm mb-6">@{profile.id.slice(0, 8)}</p>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield size={18} className="text-gray-400" />
                    <span>Status: <strong>{profile.is_verified ? 'Verificado (VIP)' : 'Standard'}</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Mail size={18} className="text-gray-400" />
                    <span>{profile.email || 'Email não disponível'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone size={18} className="text-gray-400" />
                    <span>{profile.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar size={18} className="text-gray-400" />
                    <span>Membro desde {new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <DollarSign size={18} className="text-gray-400" />
                    <span>Saldo: <strong className="text-accent">AOA {profile.balance?.toLocaleString() || 0}</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Star size={18} className="text-gray-400" />
                    <span>Plano: <strong>{profile.is_free_plan ? 'Grátis (🌟 Tudo Desbloqueado)' : 'Standard (Pago)'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit Balance Card */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
              <h3 className="text-gray-900 font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                <PlusCircle size={18} className="text-accent" /> Carregar Saldo
              </h3>
              <form onSubmit={handleAddCredit} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Valor do Carregamento (AOA)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      placeholder="Ex: 10000"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-foreground outline-none focus:border-accent transition-colors pl-12"
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">AOA</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descrição / Motivo</label>
                  <input 
                    type="text"
                    placeholder="Ex: Bónus administrativo ou Correção"
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground outline-none focus:border-accent transition-colors"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={crediting || !creditAmount || parseFloat(creditAmount) <= 0}
                  className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                >
                  {crediting ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <DollarSign size={14} className="fill-white" />
                      Confirmar Carregamento
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
              <h3 className="text-red-700 font-bold mb-4 flex items-center gap-2">
                <Shield size={18} /> Ações de Moderação
              </h3>
              
              <button 
                onClick={handleToggleFreePlan}
                disabled={updatingPlan}
                className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 mb-3 text-sm ${
                  profile.is_free_plan 
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200'
                }`}
              >
                {updatingPlan ? 'A processar...' : profile.is_free_plan ? 'Remover Plano Grátis' : 'Atribuir Plano Grátis'}
              </button>

              <button className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                Suspender Conta
              </button>
            </div>
          </div>

          {/* User Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Publicações ({posts.length})</h2>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-gray-400"><VideoIcon size={14} /> {posts.filter(p => p.content_type === 'video').length}</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-gray-400"><ImageIcon size={14} /> {posts.filter(p => p.content_type === 'photo').length}</span>
                </div>
              </div>

              <div className="divide-y divide-border">
                {posts.map((post) => (
                  <div key={post.id} className="p-6 flex gap-4 hover:bg-gray-50 transition-colors group">
                    <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-border">
                      {post.content_type === 'video' ? (
                        <div className="relative w-full h-full">
                          <video src={post.content_url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play size={20} className="text-white fill-white" /></div>
                        </div>
                      ) : (
                        <img src={post.content_url} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-1">{post.title}</h4>
                          <p className="text-sm text-gray-500 line-clamp-2">{post.description}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => router.push(`/dashboard/post/${post.id}`)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeletePost(post.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${post.is_free ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {post.is_free ? 'Grátis' : `AOA ${post.price?.toLocaleString()}`}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {posts.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    Este utilizador ainda não publicou nada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
