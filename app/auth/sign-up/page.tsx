'use client'

import Image from 'next/image'
import Link from 'next/link'
import SignupForm from '@/components/auth/signup-form'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center relative overflow-hidden p-8">
        <Image src="/model1.png" alt="Sedução e Elegância" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/50 bg-gradient-to-t from-background via-background/40 to-transparent z-0"></div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl z-0"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl z-0"></div>

        <div className="relative z-10 text-center max-w-md mt-auto mb-10 p-6 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 shadow-2xl">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">Junte-se ao <span className="text-accent">Exclusivo</span></h1>
          <p className="text-lg text-white/90 mb-8">
            Crie sua conta e tenha acesso imediato a conteúdo premium exclusivo.
          </p>
          <div className="space-y-4 text-left inline-block">
            <div className="flex items-center gap-3 text-white">
              <div className="w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_var(--accent)]"></div>
              <span className="font-medium">Cadastro rápido e seguro</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_var(--accent)]"></div>
              <span className="font-medium">Acesso imediato</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_var(--accent)]"></div>
              <span className="font-medium">Sem compromisso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-8 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <h2 className="text-3xl font-bold text-primary mb-2">XoXo</h2>
            <p className="text-muted-foreground">Crie sua conta</p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Crie sua conta</h2>
            <p className="text-muted-foreground text-sm">
              Cadastre-se para acessar conteúdXoXo
            </p>
          </div>

          <SignupForm />

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/auth/login" className="text-accent hover:underline font-medium">
              Faça login
            </Link>
          </div>

          <p className="mt-8 text-xs text-muted-foreground text-center leading-relaxed">
            Ao criar uma conta, você concorda com nossos termos de serviço e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  )
}
