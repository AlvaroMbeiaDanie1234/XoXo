'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, CreditCard, Activity, Search, Edit, Trash2,
  CheckCircle, XCircle, Link as LinkIcon, ShieldCheck,
  Wallet, List, ArrowUpRight, ArrowDownLeft, Banknote, Megaphone,
  ChevronDown, ChevronRight, AlertTriangle
} from 'lucide-react'
import { isSuperAdminEmail } from '@/lib/admin-emails'
import Header from '@/components/dashboard/header'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

export default function AdminDashboard() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [linkpagaSlug, setLinkpagaSlug] = useState('')
  const [vipBadgePrice, setVipBadgePrice] = useState('15000') // Default 15000 AOA
  const [transactionFeePercent, setTransactionFeePercent] = useState('10') // Default 10%
  const [referralBonusAmount, setReferralBonusAmount] = useState('5000') // Default 5000 AOA
  const [welcomeBonusAmount, setWelcomeBonusAmount] = useState('1500') // Default 1500 AOA
  const [freeTierMessageLimit, setFreeTierMessageLimit] = useState('3') // Default 3
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [financialResetPhrase, setFinancialResetPhrase] = useState('')
  const [resettingFinancials, setResettingFinancials] = useState(false)

  // Credit Modal States
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [selectedUserForCredit, setSelectedUserForCredit] = useState<any>(null)
  const [adminCreditAmount, setAdminCreditAmount] = useState('')
  const [adminCreditReason, setAdminCreditReason] = useState('')
  const [loadingCredit, setLoadingCredit] = useState(false)

  // Announcement Form states
  const [annType, setAnnType] = useState('comunicado') // 'comunicado' or 'anuncio'
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annTarget, setAnnTarget] = useState('') // '' means all
  const [annImage, setAnnImage] = useState('')
  const [annLink, setAnnLink] = useState('')
  const [submittingAnn, setSubmittingAnn] = useState(false)

  // Profit withdrawal states
  const [withdrawProfitAmount, setWithdrawProfitAmount] = useState('')
  const [withdrawingProfit, setWithdrawingProfit] = useState(false)

  // SMS global suspension state
  const [smsSuspendedGlobal, setSmsSuspendedGlobal] = useState(false)

  // SMS Marketing states
  const [smsMessage, setSmsMessage] = useState('')
  const [smsTargetMode, setSmsTargetMode] = useState<'all' | 'selected'>('all')
  const [smsSelectedUsers, setSmsSelectedUsers] = useState<string[]>([])
  const [sendingSms, setSendingSms] = useState(false)
  const [smsResults, setSmsResults] = useState<{ sent: number; failed: number; total: number } | null>(null)

  // Dynamic Env Variables States
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [supabasePublishableKey, setSupabasePublishableKey] = useState('')
  const [supabaseUrlServer, setSupabaseUrlServer] = useState('')
  const [supabaseAnonKeyServer, setSupabaseAnonKeyServer] = useState('')
  const [supabasePublishableKeyServer, setSupabasePublishableKeyServer] = useState('')
  const [supabaseJwtSecret, setSupabaseJwtSecret] = useState('')
  const [supabaseSecretKey, setSupabaseSecretKey] = useState('')
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState('')

  const [postgresDatabase, setPostgresDatabase] = useState('')
  const [postgresHost, setPostgresHost] = useState('')
  const [postgresPassword, setPostgresPassword] = useState('')
  const [postgresPrismaUrl, setPostgresPrismaUrl] = useState('')
  const [postgresUrl, setPostgresUrl] = useState('')
  const [postgresUrlNonPooling, setPostgresUrlNonPooling] = useState('')
  const [postgresUser, setPostgresUser] = useState('')

  const [linkpagaPublicKey, setLinkpagaPublicKey] = useState('')
  const [linkpagaSecretKey, setLinkpagaSecretKey] = useState('')
  const [linkpagaWebhookSecret, setLinkpagaWebhookSecret] = useState('')

  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('')
  const [flutterwaveSecretKey, setFlutterwaveSecretKey] = useState('')
  const [flutterwaveEncryptionKey, setFlutterwaveEncryptionKey] = useState('')
  const [flutterwaveWebhookHash, setFlutterwaveWebhookHash] = useState('')

  const [zegoAppId, setZegoAppId] = useState('')
  const [zegoAppSign, setZegoAppSign] = useState('')
  const [zegoServerSecret, setZegoServerSecret] = useState('')

  // Accordion active sections state (allows multiple sections open)
  const [openSections, setOpenSections] = useState({
    general: true,
    supabase: false,
    postgres: false,
    linkpaga: false,
    flutterwave: false,
    zego: false
  })

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleToggleFreePlan = async (userId: string, currentVal: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_free_plan: !currentVal }).eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_free_plan: !currentVal } : u))
      toast({
        title: !currentVal ? "Plano Grátis Atribuído" : "Plano Grátis Removido",
        description: !currentVal ? "O utilizador agora pode usar planos e ver conteúdos sem pagar." : "O utilizador voltou ao plano standard."
      })
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar plano",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const handleToggleVerification = async (userId: string, currentVal: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_verified: !currentVal }).eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: !currentVal } : u))
      toast({
        title: !currentVal ? "Selo VIP Atribuído" : "Selo VIP Removido",
        description: !currentVal ? "O selo oficial azul foi ativado com sucesso para este utilizador." : "O selo oficial azul foi removido."
      })
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar selo",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const handleExportTransactionsCsv = () => {
    try {
      if (transactions.length === 0) {
        toast({ title: "Sem Transações", description: "Não há transações para exportar." })
        return
      }
      
      const headers = ["Data", "Utilizador", "Email", "Tipo", "Descricao", "Valor (AOA)", "Estado"]
      const rows = transactions.map(t => [
        new Date(t.created_at).toLocaleString(),
        t.profiles?.display_name || 'Desconhecido',
        t.profiles?.email || 'N/A',
        t.type,
        t.description.replace(/"/g, '""'),
        t.amount,
        t.status
      ])
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n")
      
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `xoxo-transacoes-${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({ title: "Histórico Exportado! 📁", description: "O ficheiro CSV de transações foi gerado com sucesso." })
    } catch (err: any) {
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" })
    }
  }

  const handleExportFinancialReportCsv = () => {
    try {
      const reportData = [
        ["Relatório Financeiro XoXo", new Date().toLocaleString()],
        [],
        ["Indicador", "Valor (AOA)"],
        ["Depósitos Totais na Plataforma", totalDeposits],
        ["Levantamentos Concluídos", totalUserCompletedWithdrawals],
        ["Depósitos Líquidos (excluindo lucro)", netDeposits],
        ["Lucro Acumulado com Selos VIP", lucroVIP],
        ["Lucro Acumulado com Comissões de Conteúdo", lucroComissoes],
        ["Lucro Total Acumulado (VIP + Comissões)", lucroTotalEarned],
        ["Lucro Sacado pela Administração", lucroRetirado],
        ["Lucro Disponível para Saque", lucroDisponivel],
        ["Saldos Retidos dos Utilizadores (Intocável)", saldoRestanteNaoLucro],
        ["Dinheiro Total no Cofre (Inclusivo Lucro)", saldoTotalInclusivoLucro]
      ]
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + reportData.map(e => e.map(val => `"${val}"`).join(",")).join("\n")
      
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `xoxo-relatorio-financeiro-${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({ title: "Relatório Financeiro Exportado! 📊", description: "O ficheiro CSV do relatório foi gerado." })
    } catch (err: any) {
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" })
    }
  }

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadAdminData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || (user.email !== 'admin.xoxo@gmail.com' && user.email !== 'superadmin.xoxo@gmail.com')) {
        router.push('/')
        return
      }
      setCurrentUser(user)

      // Fetch users
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (profiles) {
        setUsers(profiles)
        const total = profiles.reduce((sum, p) => sum + (p.balance || 0), 0)
        setTotalBalance(total)
      }

      // Fetch verification requests
      const { data: vRequests } = await supabase
        .from('verification_requests')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false })
      if (vRequests) setRequests(vRequests)

      // Fetch ALL transactions
      const { data: transData } = await supabase
        .from('transactions')
        .select('*, profiles(display_name, email)')
        .order('created_at', { ascending: false })
      if (transData) setTransactions(transData)

      // Fetch system announcements
      const { data: annData } = await supabase
        .from('system_announcements')
        .select('*, target:profiles(display_name, email)')
        .order('created_at', { ascending: false })
      if (annData) setAnnouncements(annData)

      // Fetch Settings
      const { data: settings } = await supabase.from('system_settings').select('*')
      if (settings) {
        const slugSetting = settings.find(s => s.key === 'linkpaga_slug')
        if (slugSetting) setLinkpagaSlug(slugSetting.value)

        const badgePriceSetting = settings.find(s => s.key === 'vip_badge_price')
        if (badgePriceSetting) setVipBadgePrice(badgePriceSetting.value)

        const feeSetting = settings.find(s => s.key === 'transaction_fee_percent')
        if (feeSetting) setTransactionFeePercent(feeSetting.value)

        const referralSetting = settings.find(s => s.key === 'referral_bonus_amount')
        if (referralSetting) setReferralBonusAmount(referralSetting.value)

        const welcomeSetting = settings.find(s => s.key === 'welcome_bonus_amount')
        if (welcomeSetting) setWelcomeBonusAmount(welcomeSetting.value)

        const freeTierSetting = settings.find(s => s.key === 'free_tier_message_limit')
        if (freeTierSetting) setFreeTierMessageLimit(freeTierSetting.value)

        // Load Connectivity variables
        const findVal = (k: string) => settings.find(s => s.key === k)?.value || ''
        setSupabaseUrl(findVal('NEXT_PUBLIC_SUPABASE_URL'))
        setSupabaseAnonKey(findVal('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
        setSupabasePublishableKey(findVal('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
        setSupabaseUrlServer(findVal('SUPABASE_URL'))
        setSupabaseAnonKeyServer(findVal('SUPABASE_ANON_KEY'))
        setSupabasePublishableKeyServer(findVal('SUPABASE_PUBLISHABLE_KEY'))
        setSupabaseJwtSecret(findVal('SUPABASE_JWT_SECRET'))
        setSupabaseSecretKey(findVal('SUPABASE_SECRET_KEY'))
        setSupabaseServiceRoleKey(findVal('SUPABASE_SERVICE_ROLE_KEY'))

        setPostgresDatabase(findVal('POSTGRES_DATABASE'))
        setPostgresHost(findVal('POSTGRES_HOST'))
        setPostgresPassword(findVal('POSTGRES_PASSWORD'))
        setPostgresPrismaUrl(findVal('POSTGRES_PRISMA_URL'))
        setPostgresUrl(findVal('POSTGRES_URL'))
        setPostgresUrlNonPooling(findVal('POSTGRES_URL_NON_POOLING'))
        setPostgresUser(findVal('POSTGRES_USER'))

        setLinkpagaPublicKey(findVal('LINKPAGA_PUBLIC_KEY'))
        setLinkpagaSecretKey(findVal('LINKPAGA_SECRET_KEY'))
        setLinkpagaWebhookSecret(findVal('LINKPAGA_WEBHOOK_SECRET'))

        setFlutterwavePublicKey(findVal('FLUTTERWAVE_PUBLIC_KEY'))
        setFlutterwaveSecretKey(findVal('FLUTTERWAVE_SECRET_KEY'))
        setFlutterwaveEncryptionKey(findVal('FLUTTERWAVE_ENCRYPTION_KEY'))
        setFlutterwaveWebhookHash(findVal('FLUTTERWAVE_WEBHOOK_HASH'))

        setZegoAppId(findVal('NEXT_PUBLIC_ZEGO_APP_ID'))
        setZegoAppSign(findVal('NEXT_PUBLIC_ZEGO_APP_SIGN'))
        setZegoServerSecret(findVal('NEXT_PUBLIC_ZEGO_SERVER_SECRET'))

        const smsSuspended = settings.find(s => s.key === 'TELCOSMS_SUSPENDED_GLOBAL')?.value
        if (smsSuspended === 'true') setSmsSuspendedGlobal(true)
      }

      setLoading(false)
    }

    loadAdminData()
  }, [supabase, router])

  const handleUpdateSettings = async () => {
    try {
      const settingsToUpsert = [
        { key: 'linkpaga_slug', value: linkpagaSlug },
        { key: 'vip_badge_price', value: vipBadgePrice },
        { key: 'transaction_fee_percent', value: transactionFeePercent },
        { key: 'referral_bonus_amount', value: referralBonusAmount },
        { key: 'welcome_bonus_amount', value: welcomeBonusAmount },
        { key: 'free_tier_message_limit', value: freeTierMessageLimit },
        
        { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
        { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey },
        { key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', value: supabasePublishableKey },
        { key: 'SUPABASE_URL', value: supabaseUrlServer },
        { key: 'SUPABASE_ANON_KEY', value: supabaseAnonKeyServer },
        { key: 'SUPABASE_PUBLISHABLE_KEY', value: supabasePublishableKeyServer },
        { key: 'SUPABASE_JWT_SECRET', value: supabaseJwtSecret },
        { key: 'SUPABASE_SECRET_KEY', value: supabaseSecretKey },
        { key: 'SUPABASE_SERVICE_ROLE_KEY', value: supabaseServiceRoleKey },

        { key: 'POSTGRES_DATABASE', value: postgresDatabase },
        { key: 'POSTGRES_HOST', value: postgresHost },
        { key: 'POSTGRES_PASSWORD', value: postgresPassword },
        { key: 'POSTGRES_PRISMA_URL', value: postgresPrismaUrl },
        { key: 'POSTGRES_URL', value: postgresUrl },
        { key: 'POSTGRES_URL_NON_POOLING', value: postgresUrlNonPooling },
        { key: 'POSTGRES_USER', value: postgresUser },

        { key: 'LINKPAGA_PUBLIC_KEY', value: linkpagaPublicKey },
        { key: 'LINKPAGA_SECRET_KEY', value: linkpagaSecretKey },
        { key: 'LINKPAGA_WEBHOOK_SECRET', value: linkpagaWebhookSecret },

        { key: 'FLUTTERWAVE_PUBLIC_KEY', value: flutterwavePublicKey },
        { key: 'FLUTTERWAVE_SECRET_KEY', value: flutterwaveSecretKey },
        { key: 'FLUTTERWAVE_ENCRYPTION_KEY', value: flutterwaveEncryptionKey },
        { key: 'FLUTTERWAVE_WEBHOOK_HASH', value: flutterwaveWebhookHash },

        { key: 'NEXT_PUBLIC_ZEGO_APP_ID', value: zegoAppId },
        { key: 'NEXT_PUBLIC_ZEGO_APP_SIGN', value: zegoAppSign },
        { key: 'NEXT_PUBLIC_ZEGO_SERVER_SECRET', value: zegoServerSecret }
      ]

      for (const item of settingsToUpsert) {
        await supabase.from('system_settings').upsert(item)
      }

      toast({
        title: "Configurações Salvas",
        description: "As diretrizes financeiras e de integração foram guardadas.",
      })
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const handleResetFinancials = async () => {
    if (financialResetPhrase !== 'APAGAR TUDO') {
      toast({
        title: 'Confirmação incorreta',
        description: 'Escreve exatamente APAGAR TUDO para confirmar.',
        variant: 'destructive',
      })
      return
    }

    if (
      !confirm(
        'ATENÇÃO: Isto apaga TODAS as transações, zera TODOS os saldos dos utilizadores e reinicia lucros/comissões/taxas calculadas no painel. Esta ação é irreversível. Continuar?'
      )
    ) {
      return
    }

    setResettingFinancials(true)
    try {
      const res = await fetch('/api/admin/reset-financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmPhrase: financialResetPhrase }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao resetar')

      setTransactions([])
      setUsers((prev) => prev.map((u) => ({ ...u, balance: 0 })))
      setTotalBalance(0)
      setFinancialResetPhrase('')

      toast({
        title: 'Dados financeiros resetados',
        description: `${data.deletedTransactions ?? 0} transações removidas. Saldos e métricas zerados.`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao resetar',
        description: err instanceof Error ? err.message : 'Falha na operação',
        variant: 'destructive',
      })
    } finally {
      setResettingFinancials(false)
    }
  }

  const handleAdminCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserForCredit || !adminCreditAmount || parseFloat(adminCreditAmount) <= 0) return

    setLoadingCredit(true)
    const amount = parseFloat(adminCreditAmount)
    try {
      const res = await fetch('/api/admin/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForCredit.id,
          amount,
          description: adminCreditReason || 'Carregamento administrativo de saldo',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar saldo')

      const newBalance = Number(data.balance) || 0

      setUsers(prev => prev.map(u => {
        if (u.id === selectedUserForCredit.id) {
          return { ...u, balance: newBalance }
        }
        return u
      }))

      setTotalBalance(prev => {
        const oldBal = Number(selectedUserForCredit.balance) || 0
        return prev - oldBal + newBalance
      })

      toast({
        title: "Saldo Carregado! 💰✨",
        description: `Adicionado AOA ${amount.toLocaleString()} à conta de ${selectedUserForCredit.display_name || 'Usuário'}.`
      })

      setShowCreditModal(false)
      setAdminCreditAmount('')
      setAdminCreditReason('')
      setSelectedUserForCredit(null)
    } catch (err: any) {
      toast({
        title: "Erro ao Carregar Saldo",
        description: err.message || "Houve um problema ao processar o carregamento.",
        variant: "destructive"
      })
    } finally {
      setLoadingCredit(false)
    }
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!annTitle || !annContent) {
      toast({
        title: "Campos em Falta",
        description: "Por favor, preencha o título e o conteúdo.",
        variant: "destructive"
      })
      return
    }

    setSubmittingAnn(true)
    try {
      const { data, error } = await supabase.from('system_announcements').insert({
        type: annType,
        title: annTitle,
        content: annContent,
        target_user_id: annTarget || null,
        image_url: annImage || null,
        link_url: annLink || null
      }).select().single()

      if (error) throw error

      toast({
        title: "Publicado com sucesso!",
        description: "O item está agora visível de acordo com as regras de audiência.",
      })

      // Reset form
      setAnnTitle('')
      setAnnContent('')
      setAnnTarget('')
      setAnnImage('')
      setAnnLink('')

      // Reload list
      const { data: newAnnData } = await supabase
        .from('system_announcements')
        .select('*, target:profiles(display_name, email)')
        .order('created_at', { ascending: false })
      if (newAnnData) setAnnouncements(newAnnData)

    } catch (err: any) {
      toast({
        title: "Erro ao publicar",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setSubmittingAnn(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    toast({
      title: "Eliminar Comunicado/Anúncio?",
      description: "Esta ação é irreversível.",
      action: (
        <ToastAction
          altText="Confirmar"
          onClick={async () => {
            try {
              const { error } = await supabase.from('system_announcements').delete().eq('id', id)
              if (error) throw error
              setAnnouncements(announcements.filter(a => a.id !== id))
              toast({
                title: "Eliminado com Sucesso",
                description: "O item foi removido dos registos.",
              })
            } catch (err: any) {
              toast({
                title: "Erro ao eliminar",
                description: err.message,
                variant: "destructive"
              })
            }
          }}
        >
          Confirmar
        </ToastAction>
      )
    })
  }

  const handleSendBulkSms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smsMessage.trim()) {
      toast({ title: 'Mensagem vazia', description: 'Escreve a mensagem SMS.', variant: 'destructive' })
      return
    }
    setSendingSms(true)
    setSmsResults(null)
    try {
      const payload: { message: string; userIds?: string[] } = { message: smsMessage.trim() }
      if (smsTargetMode === 'selected' && smsSelectedUsers.length > 0) {
        payload.userIds = smsSelectedUsers
      }
      const res = await fetch('/api/sms/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar SMS')
      setSmsResults({ sent: data.sent, failed: data.failed, total: data.total })
      toast({
        title: 'SMS Enviados',
        description: `${data.sent} enviados, ${data.failed} falhados de ${data.total} total.`,
      })
      setSmsMessage('')
    } catch (err: any) {
      toast({ title: 'Erro ao enviar SMS', description: err.message, variant: 'destructive' })
    } finally {
      setSendingSms(false)
    }
  }

  const usersWithPhone = users.filter(u => u.phone?.trim())

  const toggleSmsUser = (userId: string) => {
    setSmsSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleWithdrawProfit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(withdrawProfitAmount)
    if (!amount || amount <= 0) {
      toast({
        title: "Valor inválido",
        description: "Por favor, introduza um valor válido e superior a 0.",
        variant: "destructive"
      })
      return
    }

    const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
    const lucroVIP = transactions
      .filter(t => t.type === 'purchase' && t.description === 'Compra de Selo VIP Oficial')
      .reduce((s, t) => s + Number(t.amount), 0)
    const totalContentPurchases = transactions
      .filter(t => t.type === 'purchase' && t.description.startsWith('Compra de conteúdo:'))
      .reduce((s, t) => s + Number(t.amount), 0)
    const totalContentEarnings = transactions
      .filter(t => t.type === 'earnings' && t.description.includes('comprou o teu conteúdo:'))
      .reduce((s, t) => s + Number(t.amount), 0)
    const lucroComissoes = Math.max(0, totalContentPurchases - totalContentEarnings)
    const lucroTotalEarned = lucroVIP + lucroComissoes
    const lucroRetirado = transactions.filter(t => t.type === 'admin_withdraw').reduce((s, t) => s + Number(t.amount), 0)
    const lucroDisponivel = lucroTotalEarned - lucroRetirado

    if (amount > lucroDisponivel) {
      toast({
        title: "Lucro Insuficiente",
        description: `O lucro disponível para saque é de AOA ${lucroDisponivel.toLocaleString()}.`,
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Confirmar Saque de Lucro?",
      description: `Tens a certeza que queres retirar AOA ${amount.toLocaleString()} do lucro?`,
      action: (
        <ToastAction
          altText="Confirmar Saque"
          onClick={async () => {
            setWithdrawingProfit(true)
            try {
              const { error } = await supabase.from('transactions').insert({
                user_id: currentUser.id,
                amount: amount,
                type: 'admin_withdraw',
                description: 'Saque de Lucro XoXo',
                status: 'completed'
              })

              if (error) throw error

              toast({
                title: "Saque Concluído",
                description: `Saque de AOA ${amount.toLocaleString()} efetuado com sucesso!`,
              })
              setWithdrawProfitAmount('')
              setTimeout(() => window.location.reload(), 1500)
            } catch (err: any) {
              toast({
                title: "Erro no processamento",
                description: err.message,
                variant: "destructive"
              })
            } finally {
              setWithdrawingProfit(false)
            }
          }}
        >
          Confirmar
        </ToastAction>
      )
    })
  }

  const handleApprove = async (requestId: string, userId: string) => {
    toast({
      title: "Aprovar Verificação?",
      description: "Deseja aprovar e verificar este utilizador?",
      action: (
        <ToastAction
          altText="Confirmar"
          onClick={async () => {
            try {
              await supabase.from('profiles').update({ is_verified: true }).eq('id', userId)
              await supabase.from('verification_requests').update({ status: 'approved' }).eq('id', requestId)
              toast({
                title: "Utilizador verificado",
                description: "O selo oficial foi ativado com sucesso.",
              })
              setTimeout(() => window.location.reload(), 1500)
            } catch (err: any) {
              toast({
                title: "Erro ao verificar",
                description: err.message,
                variant: "destructive"
              })
            }
          }}
        >
          Confirmar
        </ToastAction>
      )
    })
  }

  const handleProcessWithdrawal = async (txId: string, userId: string, amount: number) => {
    toast({
      title: "Confirmar Levantamento?",
      description: "Ao confirmar, declara que já efetuou a transferência bancária para o utilizador.",
      action: (
        <ToastAction
          altText="Confirmar"
          onClick={async () => {
            try {
              // 1. Mark transaction as completed
              await supabase.from('transactions').update({ status: 'completed' }).eq('id', txId)
              toast({
                title: "Levantamento Pago",
                description: "O levantamento foi marcado como concluído.",
              })

              // 2. Send SMS to user
              fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  body: `O seu pedido de levantamento de AOA ${amount.toLocaleString()} foi processado com sucesso! O valor foi transferido para a sua conta bancária. Obrigado por usar a nossa plataforma.`
                })
              }).catch(console.warn)

              setTimeout(() => window.location.reload(), 1500)
            } catch (err: any) {
              toast({
                title: "Erro",
                description: err.message,
                variant: "destructive"
              })
            }
          }}
        >
          Confirmar
        </ToastAction>
      )
    })
  }

  const handleToggleSmsGlobal = async () => {
    const current = smsSuspendedGlobal
    setSmsSuspendedGlobal(!current)
    await supabase.from('system_settings').upsert({ key: 'TELCOSMS_SUSPENDED_GLOBAL', value: (!current).toString() }, { onConflict: 'key' })
    toast({
      title: !current ? 'SMS Suspenso Globalmente' : 'SMS Reativado',
      description: !current ? 'Nenhum utilizador receberá SMS até reativar.' : 'Notificações SMS voltaram a funcionar para todos.'
    })
  }

  const handleToggleUserSms = async (userId: string, currentlySuspended: boolean) => {
    await supabase.from('profiles').update({ sms_suspended_by_admin: !currentlySuspended }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, sms_suspended_by_admin: !currentlySuspended } : u))
    toast({
      title: !currentlySuspended ? 'SMS do utilizador suspenso' : 'SMS do utilizador reativado',
      description: !currentlySuspended ? 'Este utilizador não receberá SMS.' : 'SMS reativado para este utilizador.'
    })
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Deseja realmente excluir este utilizador? Esta ação é irreversível.')) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao eliminar');
      // Update UI state
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({
        title: 'Utilizador eliminado',
        description: data.warning || 'O utilizador foi removido com sucesso.',
      });
    } catch (err: any) {
      toast({ title: 'Erro ao eliminar utilizador', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center"><p>Carregando painel admin...</p></div>

  const pendingWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending')

  // Financial Calculations
  const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
  const totalUserCompletedWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)

  const lucroVIP = transactions
    .filter(t => t.type === 'purchase' && t.description === 'Compra de Selo VIP Oficial')
    .reduce((s, t) => s + Number(t.amount), 0)

  const totalContentPurchases = transactions
    .filter(t => t.type === 'purchase' && t.description.startsWith('Compra de conteúdo:'))
    .reduce((s, t) => s + Number(t.amount), 0)

  const totalContentEarnings = transactions
    .filter(t => t.type === 'earnings' && t.description.includes('comprou o teu conteúdo:'))
    .reduce((s, t) => s + Number(t.amount), 0)

  const lucroComissoes = Math.max(0, totalContentPurchases - totalContentEarnings)
  const lucroTotalEarned = lucroVIP + lucroComissoes
  const lucroRetirado = transactions.filter(t => t.type === 'admin_withdraw').reduce((s, t) => s + Number(t.amount), 0)
  const netDeposits = Math.max(0, totalDeposits - lucroTotalEarned)

  // Available Profit
  const lucroDisponivel = lucroTotalEarned - lucroRetirado

  // Saldo Restante (Intocável) - the sum of all profile balances
  const saldoRestanteNaoLucro = totalBalance

  // Total Balance in Vault (including profit)
  const saldoTotalInclusivoLucro = Math.max(0, totalDeposits - totalUserCompletedWithdrawals - lucroRetirado)

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header user={currentUser} />

      <div className="max-w-[1400px] mx-auto px-4 py-8 flex gap-8">

        {/* Admin Sidebar */}
        <div className="w-[250px] flex-shrink-0">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-4 sticky top-24">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-4">Administração</h2>
            <nav className="space-y-2">
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Activity size={20} /> Visão Geral
              </button>
              <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'users' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Users size={20} /> Utilizadores
              </button>
              <button onClick={() => setActiveTab('announcements')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'announcements' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Megaphone size={20} /> Marketing
              </button>
              <button onClick={() => setActiveTab('transactions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'transactions' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <List size={20} /> Transações
              </button>
              <button onClick={() => setActiveTab('withdrawals')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'withdrawals' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <CreditCard size={20} /> Levantamentos {pendingWithdrawals.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingWithdrawals.length}</span>}
              </button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'settings' ? 'bg-accent text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                <ShieldCheck size={20} /> Definições
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Painel XoXo</h1>
              <p className="text-gray-500 mt-1">Bem-vindo à central de gestão financeira e de utilizadores.</p>
            </div>
            <div className="bg-gray-900 px-6 py-4 rounded-2xl shadow-xl flex flex-col items-end transform hover:scale-105 transition-transform">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Wallet size={14} /> Dinheiro Total dos Utilizadores</p>
              <p className="text-2xl font-black text-green-400 tracking-tighter">AOA {totalBalance.toLocaleString()}</p>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Financial Balance Sheet and Profit Withdrawal Widget */}
              <div className="bg-gradient-to-br from-gray-950 to-slate-900 rounded-3xl shadow-2xl text-white overflow-hidden border border-gray-800">
                <div className="p-8 border-b border-gray-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-950/40">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-accent mb-1">Balanço de Ganhos e Saldos da Plataforma</h2>
                    <p className="text-sm text-gray-400">Controlo auditado em tempo real de capitais e lucros.</p>
                  </div>
                  
                  {/* Export Financial Report Button */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleExportFinancialReportCsv}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 border border-slate-700"
                    >
                      Exportar Relatório (CSV)
                    </button>
                  </div>

                  {/* Profit Withdrawal Form */}
                  <form onSubmit={handleWithdrawProfit} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">AOA</span>
                      <input
                        type="number"
                        placeholder="Valor a sacar"
                        value={withdrawProfitAmount}
                        onChange={(e) => setWithdrawProfitAmount(e.target.value)}
                        className="w-full sm:w-48 pl-12 pr-4 py-2.5 bg-slate-900 border border-gray-700/80 rounded-xl font-bold text-sm text-white focus:outline-none focus:border-accent placeholder:text-gray-500"
                        min="1"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={withdrawingProfit || !withdrawProfitAmount}
                      className="bg-accent hover:bg-accent/90 text-white font-extrabold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {withdrawingProfit ? 'Processando...' : 'Sacar Lucro'}
                    </button>
                  </form>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="border-r border-gray-800/80 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Saldo Total (Inclusivo Lucro)</p>
                    </div>
                    <p className="text-4xl font-black text-blue-400 tracking-tight">AOA {saldoTotalInclusivoLucro.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">Fórmula: Total Depósitos - Levantamentos Pagos - Lucros Sacados</p>
                  </div>

                  <div className="border-r border-gray-800/80 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Lucro Disponível (Comissões & Selos)</p>
                    </div>
                    <p className="text-4xl font-black text-green-400 tracking-tight">AOA {lucroDisponivel.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-2 font-semibold text-slate-300">
                      Já Sacado: AOA {lucroRetirado.toLocaleString()} <span className="text-gray-500">(Total Acumulado: AOA {lucroTotalEarned.toLocaleString()})</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Saldo Restante (Intocável - Utilizadores)</p>
                    </div>
                    <p className="text-4xl font-black text-orange-400 tracking-tight">AOA {saldoRestanteNaoLucro.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium">Dinheiro retido que pertence ao saldo das contas dos criadores/membros</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-12 h-12 flex items-center justify-center mb-4"><Users size={24} /></div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Utilizadores Ativos</p>
                  <h3 className="text-3xl font-black mt-1">{users.length}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl w-12 h-12 flex items-center justify-center mb-4"><ArrowUpRight size={24} /></div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Depósitos na Plataforma</p>
                  <h3 className="text-3xl font-black mt-1 text-green-600">AOA {netDeposits.toLocaleString()}</h3>
                  <p className="text-[9px] text-gray-400 mt-1 font-semibold">Exclui Lucro da Plataforma</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl w-12 h-12 flex items-center justify-center mb-4"><ArrowDownLeft size={24} /></div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Levantamentos Feitos</p>
                  <h3 className="text-3xl font-black mt-1 text-red-600">AOA {transactions.filter(t => t.type === 'withdraw' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl w-12 h-12 flex items-center justify-center mb-4"><Activity size={24} /></div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total de Transações</p>
                  <h3 className="text-3xl font-black mt-1">{transactions.length}</h3>
                </div>
              </div>

              {/* Pedidos de Verificação Recentes */}
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-blue-50/50">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-blue-800"><ShieldCheck size={20} /> Pedidos de Verificação Antigos (A Eliminar)</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {requests.filter(r => r.status === 'pending').map((r) => (
                    <div key={r.id} className="p-5 bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <p className="font-bold text-lg mb-1">{r.profiles?.display_name}</p>
                      <p className="text-xs text-gray-500 mb-4">{r.profiles?.email}</p>
                      <button
                        onClick={() => handleApprove(r.id, r.user_id)}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                      >
                        Aprovar Antigo Selo
                      </button>
                    </div>
                  ))}
                  {requests.filter(r => r.status === 'pending').length === 0 && (
                    <div className="col-span-full py-8 text-center text-gray-400 font-medium">Nenhum pedido antigo pendente. (Agora é automático via Saldo)</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2"><Users /> Gestão de Utilizadores</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" placeholder="Pesquisar..." className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-accent" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-bold">Utilizador</th>
                      <th className="px-6 py-4 font-bold">Email</th>
                      <th className="px-6 py-4 font-bold">Telefone</th>
                      <th className="px-6 py-4 font-bold">Registo</th>
                      <th className="px-6 py-4 font-bold">Saldo Disponível</th>
                      <th className="px-6 py-4 font-bold">Plano</th>
                      <th className="px-6 py-4 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-sm uppercase shadow-sm">
                              {u.display_name?.charAt(0) || u.email?.charAt(0)}
                            </div>
                            <span className="font-bold flex items-center gap-1">{u.display_name || 'Sem Nome'} {u.is_verified && <CheckCircle size={14} className="text-blue-500 fill-blue-500" />}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{u.email}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{u.phone || <span className="text-gray-300">—</span>}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-6 py-4 font-black text-accent text-lg">AOA {u.balance?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleFreePlan(u.id, !!u.is_free_plan)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              u.is_free_plan 
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {u.is_free_plan ? 'Plano Grátis 🌟' : 'Standard'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleToggleVerification(u.id, !!u.is_verified)}
                            className={`p-2 rounded-lg transition-colors mr-2 ${
                              u.is_verified ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                            }`}
                            title={u.is_verified ? 'Remover Selo VIP' : 'Atribuir Selo VIP (Grátis)'}
                          >
                            <ShieldCheck size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUserForCredit(u)
                              setShowCreditModal(true)
                            }}
                            className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors mr-2"
                            title="Carregar Saldo"
                          >
                            <Banknote size={18} />
                          </button>
                          <button onClick={() => router.push(`/admin/user/${u.id}`)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors mr-2"><Edit size={18} /></button>
                          <button
                            onClick={() => handleToggleUserSms(u.id, !!u.sms_suspended_by_admin)}
                            className={`p-2 rounded-lg transition-colors mr-2 ${u.sms_suspended_by_admin ? 'text-gray-400 bg-gray-100 hover:bg-gray-200' : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
                            title={u.sms_suspended_by_admin ? 'Reativar SMS' : 'Suspender SMS'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12 19.79 19.79 0 0 1 1.21 3.15 2 2 0 0 1 3.22 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/>
                              {u.sms_suspended_by_admin && <line x1="1" y1="1" x2="23" y2="23"/>}
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2"><List /> Todas as Transações</h2>
                <button
                  onClick={handleExportTransactionsCsv}
                  className="bg-accent hover:bg-accent/90 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  Exportar Histórico (CSV)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-bold">Data</th>
                      <th className="px-6 py-4 font-bold">Utilizador</th>
                      <th className="px-6 py-4 font-bold">Tipo</th>
                      <th className="px-6 py-4 font-bold text-right">Valor</th>
                      <th className="px-6 py-4 font-bold text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{t.profiles?.display_name || t.profiles?.email || 'Desconhecido'}</p>
                          <p className="text-[10px] text-gray-400">{t.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${t.type === 'deposit' ? 'bg-green-100 text-green-700' :
                            t.type === 'earnings' ? 'bg-blue-100 text-blue-700' :
                              t.type === 'withdraw' ? 'bg-orange-100 text-orange-700' :
                                t.type === 'admin_withdraw' ? 'bg-purple-100 text-purple-700' :
                                  'bg-red-100 text-red-700'
                            }`}>
                            {t.type === 'admin_withdraw' ? 'Saque Lucro' : t.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black ${t.type === 'deposit' || t.type === 'earnings' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'deposit' || t.type === 'earnings' ? '+' : '-'} AOA {t.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border bg-orange-50/50">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-orange-800"><CreditCard /> Pedidos de Levantamento Pendentes</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingWithdrawals.map((t) => (
                    <div key={t.id} className="p-6 bg-white border border-border rounded-xl shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Banknote size={100} /></div>
                      <div className="relative z-10">
                        <p className="text-xs text-orange-600 font-bold uppercase tracking-widest mb-1">Por Processar</p>
                        <p className="font-black text-3xl mb-4">AOA {t.amount.toLocaleString()}</p>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                          <p className="text-xs text-gray-500 font-medium mb-1">Utilizador: <span className="font-bold text-gray-900">{t.profiles?.display_name || t.profiles?.email}</span></p>
                          <p className="text-xs text-gray-500 font-medium">Dados de Recebimento:</p>
                          <p className="text-sm font-bold text-gray-900 mt-1 whitespace-pre-wrap">{t.description.replace('Levantamento para: ', '')}</p>
                        </div>

                        <button
                          onClick={() => handleProcessWithdrawal(t.id, t.user_id, Number(t.amount))}
                          className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={18} /> Marcar como Transferido
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingWithdrawals.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <CheckCircle size={32} />
                      </div>
                      <p className="text-gray-500 font-medium">Não há levantamentos pendentes. Bom trabalho!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Form to create */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-border shadow-sm overflow-hidden p-6 h-fit">
                  <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2 text-accent">
                    <Megaphone size={20} /> Novo Comunicado ou Anúncio
                  </h3>

                  <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Tipo</label>
                      <select
                        value={annType}
                        onChange={(e) => setAnnType(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                      >
                        <option value="comunicado">Comunicado Oficial</option>
                        <option value="anuncio">Anúncio Publicitário</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Destinatário</label>
                      <select
                        value={annTarget}
                        onChange={(e) => setAnnTarget(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                      >
                        <option value="">Todos os Utilizadores</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Título</label>
                      <input
                        type="text"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                        placeholder="Ex: Atualização do Sistema ou Publicidade Nova"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Conteúdo</label>
                      <textarea
                        rows={4}
                        value={annContent}
                        onChange={(e) => setAnnContent(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                        placeholder="Escreve aqui o texto do anúncio ou comunicado..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Imagem URL (Opcional)</label>
                      <input
                        type="text"
                        value={annImage}
                        onChange={(e) => setAnnImage(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                        placeholder="https://..."
                      />
                    </div>

                    {annType === 'anuncio' && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Link de Destino URL (Opcional)</label>
                        <input
                          type="text"
                          value={annLink}
                          onChange={(e) => setAnnLink(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingAnn}
                      className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {submittingAnn ? 'Publicando...' : 'Publicar'}
                    </button>
                  </form>
                </div>

                {/* List of existing */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm overflow-hidden p-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-4">Comunicados & Anúncios Ativos</h3>

                  <div className="space-y-4">
                    {announcements.map((a) => (
                      <div key={a.id} className="p-5 border border-border rounded-2xl bg-gray-50 relative overflow-hidden flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${a.type === 'comunicado' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                              {a.type === 'comunicado' ? 'Comunicado' : 'Anúncio / Ads'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold">
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] font-semibold bg-gray-200 px-2 py-0.5 rounded text-gray-700">
                              Para: {a.target ? (a.target.display_name || a.target.email) : 'Todos'}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-gray-900 text-base">{a.title}</h4>
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{a.content}</p>

                          {a.image_url && (
                            <img src={a.image_url} alt="anuncio" className="max-h-40 rounded-xl object-cover mt-2 border border-gray-200" />
                          )}
                          {a.link_url && (
                            <a href={a.link_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-bold text-accent hover:underline mt-2">
                              Ver Link do Anúncio →
                            </a>
                          )}
                        </div>

                        <div className="flex items-start">
                          <button
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors self-end md:self-start"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {announcements.length === 0 && (
                      <div className="text-center py-12 text-gray-400 font-medium">Nenhum comunicado ou anúncio ativo na plataforma.</div>
                    )}
                  </div>
                </div>

              </div>

              {/* SMS Marketing Section */}
              <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2 text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12 19.79 19.79 0 0 1 1.21 3.15 2 2 0 0 1 3.22 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
                  SMS Marketing em Massa
                </h3>
                <p className="text-xs text-gray-400 mb-4">Enviar SMS para utilizadores com número de telefone registado ({usersWithPhone.length} utilizadores elegíveis).</p>

                <form onSubmit={handleSendBulkSms} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Destinatários</label>
                    <select
                      value={smsTargetMode}
                      onChange={(e) => {
                        setSmsTargetMode(e.target.value as 'all' | 'selected')
                        if (e.target.value === 'all') setSmsSelectedUsers([])
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                    >
                      <option value="all">Todos com telefone ({usersWithPhone.length})</option>
                      <option value="selected">Seleccionar utilizadores</option>
                    </select>
                  </div>

                  {smsTargetMode === 'selected' && (
                    <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-gray-50">
                      {usersWithPhone.length === 0 ? (
                        <p className="p-4 text-xs text-gray-400 text-center">Nenhum utilizador com telefone.</p>
                      ) : (
                        usersWithPhone.map(u => (
                          <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={smsSelectedUsers.includes(u.id)}
                              onChange={() => toggleSmsUser(u.id)}
                              className="rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{u.display_name || u.email}</p>
                              <p className="text-[10px] text-gray-400">{u.phone}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Mensagem SMS</label>
                    <textarea
                      rows={3}
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl font-medium outline-none focus:border-accent text-sm"
                      placeholder="Escreve a mensagem SMS..."
                      maxLength={160}
                    />
                    <p className="text-[9px] text-gray-400 mt-1">{smsMessage.length}/160 caracteres</p>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingSms || !smsMessage.trim() || (smsTargetMode === 'selected' && smsSelectedUsers.length === 0)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {sendingSms ? 'A enviar...' : `Enviar SMS${smsTargetMode === 'selected' ? ` (${smsSelectedUsers.length})` : ` para todos (${usersWithPhone.length})`}`}
                  </button>

                  {smsResults && (
                    <div className="p-3 bg-gray-50 border border-border rounded-xl text-xs space-y-1">
                      <p className="font-bold text-gray-700">Resultado do envio:</p>
                      <p className="text-green-600">Enviados: {smsResults.sent}</p>
                      <p className="text-red-500">Falhados: {smsResults.failed}</p>
                      <p className="text-gray-500">Total: {smsResults.total}</p>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-border bg-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800"><ShieldCheck /> Painel de Configurações Dinâmicas</h2>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Dica Informativa */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800 leading-relaxed">
                  <strong>💡 Conectividade Dinâmica e Flexibilidade de Hospedagem:</strong> As variáveis abaixo são carregadas por defeito a partir do ficheiro <code>.env.local</code>. No entanto, se preencher os campos abaixo, a aplicação passará a preferir os valores inseridos na base de dados. Isto permite configurar a aplicação e alterar chaves diretamente pelo painel administrativo, sem precisar de alterar código ou recomeçar servidores.
                </div>

                {/* SMS Global Control */}
                <div className={`rounded-2xl p-5 flex items-center justify-between border ${smsSuspendedGlobal ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div>
                    <p className={`font-black text-sm ${smsSuspendedGlobal ? 'text-red-800' : 'text-green-800'}`}>
                      {smsSuspendedGlobal ? '🔇 Notificações SMS Globalmente Suspensas' : '📱 Notificações SMS Ativas'}
                    </p>
                    <p className={`text-xs mt-1 ${smsSuspendedGlobal ? 'text-red-600' : 'text-green-600'}`}>
                      {smsSuspendedGlobal
                        ? 'Nenhum utilizador na plataforma receberá mensagens SMS até reativar.'
                        : 'Os utilizadores com notificações ativadas e número de telefone receberão SMS.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSmsGlobal}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${smsSuspendedGlobal ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                  >
                    {smsSuspendedGlobal ? 'Reativar SMS' : 'Suspender Globalmente'}
                  </button>
                </div>

                {/* Bloco 1: Configurações Gerais da Plataforma (Taxas & Selos) */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('general')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">1. Configurações de Taxas & Selos</span>
                    {openSections.general ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.general && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Card 1: LinkPaga */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Slug de Pagamento LinkPaga</label>
                        <input
                          type="text"
                          value={linkpagaSlug}
                          onChange={(e) => setLinkpagaSlug(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="osegredo-..."
                        />
                      </div>
                      {/* Card 2: Selo VIP */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Preço do Selo VIP (AOA)</label>
                        <input
                          type="number"
                          value={vipBadgePrice}
                          onChange={(e) => setVipBadgePrice(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="15000"
                        />
                      </div>
                      {/* Card 3: Taxas */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Comissão de Criador (%)</label>
                        <input
                          type="number"
                          value={transactionFeePercent}
                          onChange={(e) => setTransactionFeePercent(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="10"
                          min="0"
                          max="100"
                        />
                      </div>
                      {/* Card 4: Bónus de Referência */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Bónus por Referência (AOA)</label>
                        <input
                          type="number"
                          value={referralBonusAmount}
                          onChange={(e) => setReferralBonusAmount(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="5000"
                          min="0"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 leading-snug">
                          Valor creditado ao indicador quando o convidado ativa a conta.
                        </p>
                      </div>
                      {/* Card 5: Bónus de Boas-vindas */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Bónus de Registo (AOA)</label>
                        <input
                          type="number"
                          value={welcomeBonusAmount}
                          onChange={(e) => setWelcomeBonusAmount(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="1500"
                          min="0"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 leading-snug">
                          Saldo inicial creditado quando o utilizador confirma o e-mail (primeira vez). Pode ser usado para qualquer actividade quando as mensagens grátis terminam.
                        </p>
                      </div>
                      {/* Card 6: Limite de Mensagens Grátis */}
                      <div className="bg-gray-50 border border-border rounded-xl p-4 flex flex-col justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Mensagens Grátis (Limite)</label>
                        <input
                          type="number"
                          value={freeTierMessageLimit}
                          onChange={(e) => setFreeTierMessageLimit(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-border rounded-xl font-medium outline-none focus:border-accent text-xs"
                          placeholder="3"
                          min="1"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 leading-snug">
                          Número de mensagens/posts/comentários grátis para utilizadores que ainda não fizeram depósito.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 2: Supabase Credentials */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('supabase')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">2. Supabase API Credentials</span>
                    {openSections.supabase ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.supabase && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_SUPABASE_URL</label>
                        <input
                          type="text"
                          value={supabaseUrl}
                          onChange={(e) => setSupabaseUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</label>
                        <input
                          type="text"
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="eyJhbGci..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</label>
                        <input
                          type="text"
                          value={supabasePublishableKey}
                          onChange={(e) => setSupabasePublishableKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="sb_pub..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_URL</label>
                        <input
                          type="text"
                          value={supabaseUrlServer}
                          onChange={(e) => setSupabaseUrlServer(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_ANON_KEY</label>
                        <input
                          type="text"
                          value={supabaseAnonKeyServer}
                          onChange={(e) => setSupabaseAnonKeyServer(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="eyJ..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_PUBLISHABLE_KEY</label>
                        <input
                          type="text"
                          value={supabasePublishableKeyServer}
                          onChange={(e) => setSupabasePublishableKeyServer(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="sb_pub..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_JWT_SECRET</label>
                        <input
                          type="password"
                          value={supabaseJwtSecret}
                          onChange={(e) => setSupabaseJwtSecret(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="••••••••••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_SECRET_KEY</label>
                        <input
                          type="password"
                          value={supabaseSecretKey}
                          onChange={(e) => setSupabaseSecretKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="sb_secret..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">SUPABASE_SERVICE_ROLE_KEY</label>
                        <input
                          type="password"
                          value={supabaseServiceRoleKey}
                          onChange={(e) => setSupabaseServiceRoleKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="eyJ..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 3: Postgres Connection Details */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('postgres')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">3. PostgreSQL Database Connection</span>
                    {openSections.postgres ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.postgres && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_HOST</label>
                        <input
                          type="text"
                          value={postgresHost}
                          onChange={(e) => setPostgresHost(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="db.supabase.co"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_USER</label>
                        <input
                          type="text"
                          value={postgresUser}
                          onChange={(e) => setPostgresUser(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="postgres"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_PASSWORD</label>
                        <input
                          type="password"
                          value={postgresPassword}
                          onChange={(e) => setPostgresPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="••••••••••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_DATABASE</label>
                        <input
                          type="text"
                          value={postgresDatabase}
                          onChange={(e) => setPostgresDatabase(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="postgres"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_URL</label>
                        <input
                          type="text"
                          value={postgresUrl}
                          onChange={(e) => setPostgresUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent font-mono"
                          placeholder="postgres://..."
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_URL_NON_POOLING</label>
                        <input
                          type="text"
                          value={postgresUrlNonPooling}
                          onChange={(e) => setPostgresUrlNonPooling(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent font-mono"
                          placeholder="postgres://..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">POSTGRES_PRISMA_URL</label>
                        <input
                          type="text"
                          value={postgresPrismaUrl}
                          onChange={(e) => setPostgresPrismaUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent font-mono"
                          placeholder="postgres://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 4: LinkPaga Payment Keys */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('linkpaga')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">4. LinkPaga Integrations Keys</span>
                    {openSections.linkpaga ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.linkpaga && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">LINKPAGA_PUBLIC_KEY</label>
                        <input
                          type="text"
                          value={linkpagaPublicKey}
                          onChange={(e) => setLinkpagaPublicKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="pk_live_..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">LINKPAGA_SECRET_KEY</label>
                        <input
                          type="password"
                          value={linkpagaSecretKey}
                          onChange={(e) => setLinkpagaSecretKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="sk_live_..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">LINKPAGA_WEBHOOK_SECRET</label>
                        <input
                          type="password"
                          value={linkpagaWebhookSecret}
                          onChange={(e) => setLinkpagaWebhookSecret(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="sk_live_..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 5: Flutterwave */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('flutterwave')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">5. Flutterwave (Depósitos)</span>
                    {openSections.flutterwave ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.flutterwave && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">FLUTTERWAVE_PUBLIC_KEY</label>
                        <input
                          type="text"
                          value={flutterwavePublicKey}
                          onChange={(e) => setFlutterwavePublicKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="FLWPUBK_TEST-..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">FLUTTERWAVE_SECRET_KEY</label>
                        <input
                          type="password"
                          value={flutterwaveSecretKey}
                          onChange={(e) => setFlutterwaveSecretKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="FLWSECK_TEST-..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">FLUTTERWAVE_ENCRYPTION_KEY</label>
                        <input
                          type="password"
                          value={flutterwaveEncryptionKey}
                          onChange={(e) => setFlutterwaveEncryptionKey(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">FLUTTERWAVE_WEBHOOK_HASH (verif-hash)</label>
                        <input
                          type="password"
                          value={flutterwaveWebhookHash}
                          onChange={(e) => setFlutterwaveWebhookHash(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="Secret hash do dashboard Flutterwave"
                        />
                        <p className="text-[9px] text-gray-400 mt-1">Webhook URL: /api/webhooks/flutterwave</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 6: ZegoCloud Live Streaming Keys */}
                <div className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => toggleSection('zego')}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between font-black text-xs uppercase tracking-wider text-gray-800 border-b border-border hover:bg-gray-100/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">6. ZegoCloud Live Streaming Configuration</span>
                    {openSections.zego ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  {openSections.zego && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_ZEGO_APP_ID</label>
                        <input
                          type="text"
                          value={zegoAppId}
                          onChange={(e) => setZegoAppId(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="293147689"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_ZEGO_APP_SIGN</label>
                        <input
                          type="text"
                          value={zegoAppSign}
                          onChange={(e) => setZegoAppSign(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="0dc3e5a128c..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">NEXT_PUBLIC_ZEGO_SERVER_SECRET</label>
                        <input
                          type="password"
                          value={zegoServerSecret}
                          onChange={(e) => setZegoServerSecret(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-border rounded-xl text-xs outline-none focus:border-accent"
                          placeholder="66ad70c09d..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Superadmin: reset financeiro total */}
                {isSuperAdminEmail(currentUser?.email) && (
                  <div className="border-2 border-red-300 rounded-2xl overflow-hidden bg-red-50/50">
                    <div className="px-6 py-4 bg-red-100/80 border-b border-red-200 flex items-center gap-3">
                      <AlertTriangle size={20} className="text-red-700 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-black text-red-900 uppercase tracking-wide">
                          Zona crítica — Superadmin
                        </h3>
                        <p className="text-xs text-red-800/90 mt-0.5">
                          Apaga todo o histórico de transações, zera saldos dos utilizadores, lucros, comissões e
                          métricas financeiras do painel.
                        </p>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <ul className="text-xs text-red-900/80 space-y-1 list-disc list-inside">
                        <li>Todas as transações (depósitos, compras, ganhos, levantamentos, taxas)</li>
                        <li>Saldo disponível de todos os utilizadores → AOA 0</li>
                        <li>Lucros da plataforma, cofre e relatórios financeiros → zerados</li>
                      </ul>
                      <div>
                        <label className="text-[10px] font-bold text-red-700 uppercase tracking-widest block mb-2">
                          Escreve APAGAR TUDO para confirmar
                        </label>
                        <input
                          type="text"
                          value={financialResetPhrase}
                          onChange={(e) => setFinancialResetPhrase(e.target.value)}
                          placeholder="APAGAR TUDO"
                          className="w-full max-w-md px-4 py-2.5 bg-white border border-red-300 rounded-xl text-sm font-mono outline-none focus:border-red-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleResetFinancials}
                        disabled={resettingFinancials || financialResetPhrase !== 'APAGAR TUDO'}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors"
                      >
                        {resettingFinancials ? (
                          <>A processar...</>
                        ) : (
                          <>
                            <Trash2 size={18} />
                            Apagar histórico e zerar saldos
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Save button at bottom of settings */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <button
                    onClick={handleUpdateSettings}
                    className="bg-accent text-white px-8 py-3.5 rounded-xl font-bold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 text-xs"
                  >
                    <CheckCircle size={16} /> Salvar Configurações
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Admin Credit Modal */}
          {showCreditModal && selectedUserForCredit && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in scale-in duration-300 relative overflow-hidden text-left">
                {/* Background luxury gradient blur */}
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />

                <div className="relative z-10 text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Banknote size={24} />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">Carregar Saldo (Crédito)</h3>
                  <p className="text-xs text-gray-500 mt-1">Carregar saldo na conta de: <strong className="text-gray-800">{selectedUserForCredit.display_name || 'Usuário'}</strong></p>
                </div>

                <form onSubmit={handleAdminCredit} className="space-y-4 relative z-10">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Valor do Carregamento (AOA)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 25000"
                        value={adminCreditAmount}
                        onChange={(e) => setAdminCreditAmount(e.target.value)}
                        className="w-full bg-gray-50 border border-border rounded-xl px-3 py-3 text-xs font-bold text-foreground outline-none focus:border-accent transition-colors pl-12"
                        required
                        min="1"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">AOA</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Descrição / Motivo</label>
                    <input
                      type="text"
                      placeholder="Ex: Carregamento Administrativo de Saldo"
                      value={adminCreditReason}
                      onChange={(e) => setAdminCreditReason(e.target.value)}
                      className="w-full bg-gray-50 border border-border rounded-xl px-3 py-3 text-xs text-foreground outline-none focus:border-accent transition-colors"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreditModal(false)
                        setAdminCreditAmount('')
                        setAdminCreditReason('')
                        setSelectedUserForCredit(null)
                      }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-3 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loadingCredit || !adminCreditAmount || parseFloat(adminCreditAmount) <= 0}
                      className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      {loadingCredit ? 'Processando...' : 'Confirmar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
