'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, User, Mail, Lock, Building, Phone, MapPin, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'

const niches = [
  { id: 'salao', name: 'Salão de Beleza', icon: '💇' },
  { id: 'barbearia', name: 'Barbearia', icon: '💈' },
  { id: 'clinica', name: 'Clínica', icon: '🏥' },
  { id: 'consultorio', name: 'Consultório', icon: '🩺' },
  { id: 'advocacia', name: 'Advocacia', icon: '⚖️' },
  { id: 'contabilidade', name: 'Contabilidade', icon: '📊' },
  { id: 'academia', name: 'Academia', icon: '💪' },
  { id: 'restaurante', name: 'Restaurante', icon: '🍽️' },
  { id: 'oficina', name: 'Oficina', icon: '🔧' },
  { id: 'sindicato', name: 'Sindicato/Associação', icon: '🏛️' },
  { id: 'outro', name: 'Outro', icon: '🏢' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    niche: 'salao',
    phone: '',
    address: ''
  })

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validações
    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (!form.name || !form.email || !form.businessName) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          businessName: form.businessName,
          niche: form.niche,
          phone: form.phone,
          address: form.address
        })
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Erro ao criar conta')
        setLoading(false)
        return
      }

      // Sucesso! Fazer login automático
      setSuccess(true)
      
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false
      })

      if (result?.ok) {
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 1500)
      }

    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Conta criada!</h2>
            <p className="text-slate-400">Redirecionando para o painel...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-slate-800 border-slate-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">Criar Conta</CardTitle>
          <CardDescription className="text-slate-400">
            Cadastre-se e comece a usar o BotWhats
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            {/* Dados do usuário */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4" />
                Seus dados
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Seu nome *</label>
                  <Input
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="Maria Silva"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Email *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Senha *</label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Confirmar senha *</label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => handleChange('confirmPassword', e.target.value)}
                    placeholder="Repita a senha"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
            
            {/* Dados do negócio */}
            <div className="space-y-3 pt-2 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Dados do estabelecimento
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">Nome do estabelecimento *</label>
                  <Input
                    value={form.businessName}
                    onChange={e => handleChange('businessName', e.target.value)}
                    placeholder="Salão Bela Vista"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">Tipo de negócio</label>
                  <Select value={form.niche} onValueChange={v => handleChange('niche', v)}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {niches.map(n => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.icon} {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-xs text-slate-400">Telefone</label>
                  <Input
                    value={form.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="text-xs text-slate-400">Endereço</label>
                  <Input
                    value={form.address}
                    onChange={e => handleChange('address', e.target.value)}
                    placeholder="Rua, número"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Já tem conta?{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Fazer login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
