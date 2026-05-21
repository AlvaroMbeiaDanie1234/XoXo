'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, BookOpen, Image as ImageIcon, ShieldCheck, Zap, Infinity, CheckCircle2, ArrowRight, Star, Globe } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { Language } from '@/lib/translations'

export default function HomePage() {
  const { t, lang, changeLanguage } = useTranslation()
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative selection:bg-accent/30">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="font-bold text-2xl tracking-tighter">
            <span className="text-foreground">O</span>
            <span className="text-accent ml-1">{t('nav.logo').replace('O', '')}</span>
          </div>

          <div className="flex gap-4 items-center">
            {/* Language Selector Dropdown */}
            <div className="relative mr-2" ref={langRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-full border border-border/40 hover:bg-muted/40 transition-colors font-semibold text-xs"
                title="Mudar Idioma / Change Language"
              >
                <Globe size={14} className="text-muted-foreground" />
                <span>{lang}</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-card/95 backdrop-blur-md rounded-xl shadow-2xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        changeLanguage('PT')
                        setLangDropdownOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'PT' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}`}
                    >
                      <span className="text-sm">🇵🇹</span>
                      Português
                    </button>
                    <button
                      onClick={() => {
                        changeLanguage('EN')
                        setLangDropdownOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'EN' ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}`}
                    >
                      <span className="text-sm">🇬🇧</span>
                      English
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/auth/login"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.login')}
            </Link>
            <Link
              href="/auth/sign-up"
              className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              {t('nav.signup')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 pt-24 pb-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side text */}
            <div className="flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border mb-8 backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-secondary-foreground">{t('hero.badge')}</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                {t('hero.title_part1')}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
                    {t('hero.title_exclusivo')}
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-accent/20 blur-md" />
                </span>
                <br />
                {t('hero.title_part2')}
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground mb-6 leading-relaxed max-w-xl">
                {t('hero.desc')}
              </p>

              <div className="flex items-center gap-3.5 p-4.5 rounded-2xl bg-accent/5 border border-accent/10 mb-8 max-w-xl text-left backdrop-blur-sm shadow-sm hover:border-accent/20 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-accent tracking-wider">{t('hero.secure_chats')}</p>
                  <p className="text-xs text-muted-foreground italic mt-0.5 leading-relaxed">
                    {t('hero.secure_chats_desc')}
                    <span className="font-bold text-foreground not-italic block mt-1">{t('hero.secure_chats_quote')}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 w-full sm:max-w-md">
                <Link
                  href="/auth/sign-up"
                  className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-accent text-accent-foreground font-semibold text-lg hover:shadow-[0_0_20px_rgba(227,30,36,0.4)] transition-all hover:-translate-y-1 w-full"
                >
                  {t('hero.cta_start')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center px-8 py-4 rounded-full bg-card border border-border text-card-foreground font-semibold text-lg hover:bg-muted backdrop-blur-sm transition-all w-full"
                >
                  {t('hero.cta_login')}
                </Link>
              </div>
            </div>

            {/* Right side Images */}
            <div className="relative h-[600px] w-full hidden lg:block">
              {/* Image 1 (Front/Center) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-[400px] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] z-30 border border-border/50 transform hover:scale-105 transition-transform duration-500">
                <Image src="/model1.png" alt="Elegância Premium" fill priority className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Image 2 (Back Left) */}
              <div className="absolute top-1/2 left-0 -translate-y-[60%] w-60 h-80 rounded-2xl overflow-hidden shadow-2xl z-20 border border-border/50 opacity-80 transform -rotate-6 hover:-rotate-3 hover:scale-105 hover:opacity-100 hover:z-40 transition-all duration-500">
                <Image src="/model2.png" alt="Estilo Sofisticado" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Image 3 (Back Right) */}
              <div className="absolute top-1/2 right-0 -translate-y-[40%] w-60 h-80 rounded-2xl overflow-hidden shadow-2xl z-20 border border-border/50 opacity-80 transform rotate-6 hover:rotate-3 hover:scale-105 hover:opacity-100 hover:z-40 transition-all duration-500">
                <Image src="/model3.png" alt="Luxo e Sedução" fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Decoration */}
              <div className="absolute -bottom-6 right-10 z-40 bg-card border border-border p-4 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-4 animate-bounce-slow">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-background overflow-hidden relative">
                    <Image src="/model1.png" alt="User" fill className="object-cover" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-background overflow-hidden relative">
                    <Image src="/model2.png" alt="User" fill className="object-cover" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-background overflow-hidden relative">
                    <Image src="/model3.png" alt="User" fill className="object-cover" />
                  </div>
                </div>
                <div>
                  <div className="flex text-accent text-sm">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-xs font-bold text-foreground">{t('hero.community_vip')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-8 rounded-3xl bg-card border border-border hover:bg-muted/50 transition-all hover:-translate-y-2 hover:shadow-lg backdrop-blur-sm relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform relative z-10">
                <Play className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">{t('features.videos.title')}</h3>
              <p className="text-muted-foreground leading-relaxed relative z-10">
                {t('features.videos.desc')}
              </p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            </div>

            <div className="group p-8 rounded-3xl bg-card border border-border hover:bg-muted/50 transition-all hover:-translate-y-2 hover:shadow-lg backdrop-blur-sm relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform relative z-10">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">{t('features.articles.title')}</h3>
              <p className="text-muted-foreground leading-relaxed relative z-10">
                {t('features.articles.desc')}
              </p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            </div>

            <div className="group p-8 rounded-3xl bg-card border border-border hover:bg-muted/50 transition-all hover:-translate-y-2 hover:shadow-lg backdrop-blur-sm relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform relative z-10">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 relative z-10">{t('features.photos.title')}</h3>
              <p className="text-muted-foreground leading-relaxed relative z-10">
                {t('features.photos.desc')}
              </p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            </div>
          </div>
        </section>

        {/* Visual Break / Banner */}
        <section className="relative w-full h-[400px] overflow-hidden my-12 border-y border-border">
          <Image src="/model3.png" alt="Luxo" fill className="object-cover object-center opacity-40 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-lg">
                <h2 className="text-4xl font-bold mb-4 text-foreground">{t('banner.title')}</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  {t('banner.desc')}
                </p>
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background font-medium hover:scale-105 transition-transform"
                >
                  {t('banner.cta')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Metrics */}
        <section className="bg-card/30 py-20 relative overflow-hidden backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">
                {t('metrics.title')}
                <span className="text-accent">{t('metrics.title_colored')}</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 rounded-full bg-accent/10 text-accent mb-2">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="text-3xl font-bold">100%</div>
                <p className="text-muted-foreground font-medium">{t('metrics.privacy')}</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 rounded-full bg-accent/10 text-accent mb-2">
                  <Zap className="w-8 h-8" />
                </div>
                <div className="text-3xl font-bold">24/7</div>
                <p className="text-muted-foreground font-medium">{t('metrics.access')}</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 rounded-full bg-accent/10 text-accent mb-2">
                  <Infinity className="w-8 h-8" />
                </div>
                <div className="text-3xl font-bold">∞</div>
                <p className="text-muted-foreground font-medium">{t('metrics.new_content')}</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-4 rounded-full bg-accent/10 text-accent mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="text-3xl font-bold">✓</div>
                <p className="text-muted-foreground font-medium">{t('metrics.premium_quality')}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-10 text-center border-t border-border">
        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} XoXo. {t('footer.rights')}
        </p>
      </footer>
    </div>
  )
}
