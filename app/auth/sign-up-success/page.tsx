import Link from 'next/link'
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0b0c] p-6 md:p-10 relative overflow-hidden">
      {/* Elementos decorativos de fundo premium */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#ff2b85]/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#ff2b85]/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-widest">
            XO<span className="text-[#ff2b85] drop-shadow-[0_0_15px_rgba(255,43,133,0.5)]">XO</span>
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-2">Plataforma Premium Exclusiva</p>
        </div>

        {/* Card Elegante com Glassmorphism */}
        <div className="bg-[#161618]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 md:p-10 shadow-2xl relative">
          {/* Luz de destaque superior */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#ff2b85]/50 to-transparent"></div>

          {/* Ícone de Email Pulsante */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#ff2b85]/20 blur-xl animate-pulse"></div>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1d1d21] to-[#161618] border border-white/10 flex items-center justify-center relative shadow-inner">
                <Mail className="w-10 h-10 text-[#ff2b85] animate-bounce duration-1000" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              </div>
            </div>
          </div>

          {/* Título & Descrição */}
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Verifique a sua caixa de entrada
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              Enviámos um link de ativação exclusivo para o seu e-mail para confirmar a sua conta e desbloquear o acesso premium.
            </p>
          </div>

          {/* Dicas e Instruções */}
          <div className="space-y-4 bg-white/[0.02] border border-white/5 rounded-2xl p-5 mb-8">
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-[#ff2b85] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">Verifique a pasta de Spam</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Às vezes, o e-mail de ativação pode ser classificado incorretamente pelo seu provedor de e-mail.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="w-5 h-5 text-[#ff2b85] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white">Link válido por 24 horas</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Por motivos de segurança, o link expira após 24 horas do registo.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#ff2b85] to-[#e01a6f] text-white font-semibold rounded-2xl hover:opacity-95 shadow-[0_4px_20px_rgba(255,43,133,0.3)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Já ativou a conta? Faça Login
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/sign-up"
              className="flex w-full items-center justify-center py-3.5 px-4 bg-transparent border border-white/10 text-zinc-300 font-medium rounded-2xl hover:bg-white/5 hover:text-white transition duration-200"
            >
              Voltar ao Registo
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Precisa de ajuda? Entre em contacto com o suporte em <span className="text-[#ff2b85]">suporte@xoxopremium.com</span>
        </p>
      </div>
    </div>
  )
}
