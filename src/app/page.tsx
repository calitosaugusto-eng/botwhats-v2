'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { 
  MessageSquare, Users, Send, Settings, BarChart3, 
  Bot, Zap, Clock, TrendingUp, AlertCircle, CheckCircle,
  Smartphone, Globe, Plus, Search, MoreHorizontal,
  Phone, Mail, Calendar, FileText, Bell, ChevronRight,
  Play, Pause, RefreshCw, Terminal, Copy, ExternalLink,
  X, Save, Clock4, MessageCircle, Sparkles, Shield
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

// Tipos
interface Message {
  id: string
  content: string
  direction: 'inbound' | 'outbound'
  isFromBot: boolean
  createdAt: string
}

interface Member {
  id: string
  name: string
  phone: string
  email?: string
  status: string
  category?: string
}

interface Conversation {
  id: string
  phone: string
  status: string
  humanTakeover?: boolean
  member?: Member
  messages?: Message[]
  updatedAt: string
}

export default function Dashboard() {
  // Estados
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeConversations: 0,
    messagesToday: 0,
    responseRate: 95
  })
  
  // Chat
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [selectedNiche, setSelectedNiche] = useState('sindicato')
  
  // Conversas
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  
  // Membros
  const [members, setMembers] = useState<Member[]>([])
  const [searchMember, setSearchMember] = useState('')
  
  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('')
  
  // Config
  const [botName, setBotName] = useState('Assistente Virtual')
  const [welcomeMessage, setWelcomeMessage] = useState('Olá! Como posso ajudar?')
  const [businessHours, setBusinessHours] = useState({ start: '08:00', end: '18:00' })
  const [enableOutsideHours, setEnableOutsideHours] = useState(true)
  const [outsideHoursMessage, setOutsideHoursMessage] = useState('Estamos fora do horário de atendimento. Deixe sua mensagem que retornamos em breve!')
  const [botTone, setBotTone] = useState('professional')
  const [autoReply, setAutoReply] = useState(true)
  
  // Modais
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showConversation, setShowConversation] = useState(false)
  const [conversationMessages, setConversationMessages] = useState<Message[]>([])
  const [humanReply, setHumanReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    email: '',
    category: '',
    status: 'active'
  })

  // Carregar dados iniciais
  useEffect(() => {
    loadStats()
    loadMembers()
    loadConversations()
    loadConfig()
  }, [])

  // Carregar mensagens da conversa
  const loadConversationMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`)
      const data = await res.json()
      if (data.success) {
        setConversationMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    }
  }

  // Abrir conversa
  const openConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    loadConversationMessages(conv.id)
    setHumanReply('')
    setShowConversation(true)
  }

  // Enviar resposta humana (assume controle da conversa)
  const sendHumanReply = async () => {
    if (!humanReply.trim() || !selectedConversation) return
    
    setSendingReply(true)
    try {
      const res = await fetch(`/api/conversations/${selectedConversation.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: humanReply })
      })
      
      const data = await res.json()
      
      if (data.success) {
        const newMsg: Message = {
          id: `human-${Date.now()}`,
          content: humanReply,
          direction: 'outbound',
          isFromBot: false,
          createdAt: new Date().toISOString()
        }
        setConversationMessages(prev => [...prev, newMsg])
        setHumanReply('')
        setSelectedConversation(prev => prev ? { ...prev, humanTakeover: true } : null)
        loadConversations()
      } else {
        alert('Erro ao enviar mensagem: ' + data.error)
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao enviar mensagem')
    } finally {
      setSendingReply(false)
    }
  }

  // Nichos disponíveis
  const niches = [
    { id: 'sindicato', name: 'Sindicato', icon: '🏛️' },
    { id: 'associacao', name: 'Associação', icon: '🤝' },
    { id: 'clinica', name: 'Clínica', icon: '🏥' },
    { id: 'oficina', name: 'Oficina', icon: '🔧' },
    { id: 'salao', name: 'Salão', icon: '💇' },
    { id: 'barbearia', name: 'Barbearia', icon: '💈' },
    { id: 'contabilidade', name: 'Contabilidade', icon: '📊' },
    { id: 'advocacia', name: 'Advocacia', icon: '⚖️' },
    { id: 'academia', name: 'Academia', icon: '💪' },
    { id: 'restaurante', name: 'Restaurante', icon: '🍽️' },
  ]

  const loadStats = async () => {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      if (data.success) {
        setStats(prev => ({ ...prev, ...data.stats }))
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error)
    }
  }

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/members')
      const data = await res.json()
      if (data.success) {
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error)
    }
  }

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      if (data.success) {
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error)
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      if (data.success && data.config) {
        setBotName(data.config.botName || 'Assistente Virtual')
        setWelcomeMessage(data.config.welcomeMessage || 'Olá! Como posso ajudar?')
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error)
    }
  }

  // Enviar mensagem no chat de teste
  const sendTestMessage = async () => {
    if (!inputMessage.trim()) return
    
    setLoading(true)
    
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage,
      direction: 'inbound',
      isFromBot: false,
      createdAt: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, userMsg])
    const currentMessage = inputMessage
    setInputMessage('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentMessage,
          niche: selectedNiche
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          content: data.response,
          direction: 'outbound',
          isFromBot: true,
          createdAt: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, botMsg])
      } else {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          content: `Erro: ${data.error || 'Não foi possível processar a mensagem'}`,
          direction: 'outbound',
          isFromBot: true,
          createdAt: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, errorMsg])
      }
    } catch (error) {
      console.error('Erro:', error)
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        content: 'Erro de conexão. Verifique se o servidor está funcionando.',
        direction: 'outbound',
        isFromBot: true,
        createdAt: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  // Adicionar membro
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.phone) {
      alert('Nome e telefone são obrigatórios')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      })
      
      const data = await res.json()
      
      if (data.success) {
        setMembers(prev => [...prev, data.member])
        setNewMember({ name: '', phone: '', email: '', category: '', status: 'active' })
        setShowAddMember(false)
        alert('Membro adicionado com sucesso!')
      } else {
        alert('Erro ao adicionar membro: ' + data.error)
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao adicionar membro')
    } finally {
      setLoading(false)
    }
  }

  // Salvar configurações
  const handleSaveConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName,
          welcomeMessage,
          businessHours,
          outsideHoursMessage,
          botTone,
          autoReply,
          niche: selectedNiche
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('Configurações salvas com sucesso!')
        setShowSettings(false)
      } else {
        alert('Erro ao salvar: ' + data.error)
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao salvar configurações')
    } finally {
      setLoading(false)
    }
  }

  // Enviar broadcast
  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return
    setLoading(true)
    
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert(`Broadcast enviado!\nSucesso: ${data.result.success}\nFalhas: ${data.result.failed}`)
        setBroadcastMessage('')
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  // Webhook URL
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/whatsapp`
    : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">BotWhats</h1>
              <p className="text-xs text-slate-400">Plataforma de Automação WhatsApp</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-emerald-500 text-emerald-400">
              <Zap className="w-3 h-3 mr-1" />
              Sistema Ativo
            </Badge>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-400 hover:text-white"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Modal de Configurações */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configurações do Sistema
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure o comportamento do seu bot de atendimento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Configurações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-500" />
                Identidade do Bot
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white font-medium">Nome do Bot</Label>
                  <Input
                    value={botName}
                    onChange={e => setBotName(e.target.value)}
                    className="bg-slate-900 border-slate-600 mt-1"
                    placeholder="Ex: Assistente Virtual"
                  />
                </div>
                <div>
                  <Label className="text-white font-medium">Nicho de Atuação</Label>
                  <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                    <SelectTrigger className="bg-slate-100 text-slate-900 border-slate-300 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-300">
                      {niches.map(n => (
                        <SelectItem key={n.id} value={n.id} className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">
                          {n.icon} {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-white font-medium">Mensagem de Boas-vindas</Label>
                <textarea
                  className="w-full h-20 rounded-lg bg-slate-900 border border-slate-600 p-3 text-white resize-none mt-1"
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder="Primeira mensagem que o bot envia..."
                />
              </div>
            </div>

            {/* Horário de Funcionamento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock4 className="w-4 h-4 text-blue-500" />
                Horário de Atendimento
              </h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Resposta Automática</Label>
                  <p className="text-xs text-slate-500">Bot responde automaticamente a todas as mensagens</p>
                </div>
                <Switch checked={autoReply} onCheckedChange={setAutoReply} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white font-medium">Início</Label>
                  <Input
                    type="time"
                    value={businessHours.start}
                    onChange={e => setBusinessHours(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-slate-900 border-slate-600 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-white font-medium">Término</Label>
                  <Input
                    type="time"
                    value={businessHours.end}
                    onChange={e => setBusinessHours(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-slate-900 border-slate-600 mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Atender fora do horário</Label>
                  <p className="text-xs text-slate-500">Responder quando estiver fechado</p>
                </div>
                <Switch checked={enableOutsideHours} onCheckedChange={setEnableOutsideHours} />
              </div>
              
              <div>
                <Label className="text-white font-medium">Mensagem fora do horário</Label>
                <textarea
                  className="w-full h-16 rounded-lg bg-slate-900 border border-slate-600 p-3 text-white resize-none mt-1"
                  value={outsideHoursMessage}
                  onChange={e => setOutsideHoursMessage(e.target.value)}
                  disabled={!enableOutsideHours}
                />
              </div>
            </div>

            {/* Tom de Voz */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-purple-500" />
                Tom de Comunicação
              </h3>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'professional', label: 'Profissional', desc: 'Formal e educado' },
                  { id: 'friendly', label: 'Amigável', desc: 'Casual e próximo' },
                  { id: 'technical', label: 'Técnico', desc: 'Direto e preciso' }
                ].map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => setBotTone(tone.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      botTone === tone.id 
                        ? 'border-emerald-500 bg-emerald-500/20 text-white' 
                        : 'border-slate-500 bg-slate-700 hover:border-slate-400 text-white'
                    }`}
                  >
                    <p className="font-medium text-white">{tone.label}</p>
                    <p className="text-xs text-slate-300">{tone.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSaveConfig}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowSettings(false)}
                className="border-slate-600"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Conversa */}
      <Dialog open={showConversation} onOpenChange={setShowConversation}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              {selectedConversation?.member?.name || selectedConversation?.phone}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Conversa via WhatsApp • {selectedConversation?.phone}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={selectedConversation?.status === 'active' ? 'default' : 'secondary'}>
                {selectedConversation?.status === 'active' ? 'Ativa' : 'Resolvida'}
              </Badge>
              
              {selectedConversation?.humanTakeover ? (
                <Badge variant="outline" className="border-blue-500 text-blue-400 bg-blue-500/10">
                  <Users className="w-3 h-3 mr-1" />
                  Humano Atendendo
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500 text-emerald-400 bg-emerald-500/10">
                  <Bot className="w-3 h-3 mr-1" />
                  Bot Atendimento
                </Badge>
              )}
            </div>
            
            {!selectedConversation?.humanTakeover && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <div className="text-xs">
                    <p className="text-yellow-200 font-medium">Bot está respondendo automaticamente</p>
                    <p className="text-yellow-200/70">Envie uma mensagem para assumir esta conversa. O bot parará de responder.</p>
                  </div>
                </div>
              </div>
            )}
            
            <ScrollArea className="h-[300px] pr-4">
              {conversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                  <p>Carregando mensagens...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversationMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.isFromBot ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.isFromBot
                            ? 'bg-slate-700 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {msg.isFromBot && (
                          <p className="text-xs text-emerald-400 mb-1 flex items-center gap-1">
                            <Bot className="w-3 h-3" /> Bot
                          </p>
                        )}
                        {!msg.isFromBot && (
                          <p className="text-xs text-blue-300 mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Você
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <div className="border-t border-slate-700 pt-4">
            <div className="flex gap-2">
              <Input
                placeholder={selectedConversation?.humanTakeover 
                  ? "Digite sua mensagem..." 
                  : "Digite para assumir a conversa..."}
                value={humanReply}
                onChange={e => setHumanReply(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendHumanReply()}
                className="bg-slate-900 border-slate-600 text-white"
                disabled={sendingReply}
              />
              <Button 
                onClick={sendHumanReply}
                disabled={sendingReply || !humanReply.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sendingReply ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 Ao enviar, você assume o controle e o bot para de responder automaticamente.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Adicionar Membro */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Adicionar Novo Membro
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Cadastre um novo membro no sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white font-medium">Nome *</Label>
              <Input
                value={newMember.name}
                onChange={e => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-900 border-slate-600 mt-1"
                placeholder="Nome completo"
              />
            </div>
            
            <div>
              <Label className="text-white font-medium">Telefone *</Label>
              <Input
                value={newMember.phone}
                onChange={e => setNewMember(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-slate-900 border-slate-600 mt-1"
                placeholder="5511999999999"
              />
              <p className="text-xs text-slate-500 mt-1">Formato: código país + DDD + número</p>
            </div>
            
            <div>
              <Label className="text-white font-medium">Email</Label>
              <Input
                type="email"
                value={newMember.email}
                onChange={e => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                className="bg-slate-900 border-slate-600 mt-1"
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white font-medium">Categoria</Label>
                <Input
                  value={newMember.category}
                  onChange={e => setNewMember(prev => ({ ...prev, category: e.target.value }))}
                  className="bg-slate-900 border-slate-600 mt-1"
                  placeholder="Ex: Premium, Básico..."
                />
              </div>
              <div>
                <Label className="text-white font-medium">Status</Label>
                <Select 
                  value={newMember.status} 
                  onValueChange={v => setNewMember(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger className="bg-slate-100 text-slate-900 border-slate-300 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-300">
                    <SelectItem value="active" className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">Ativo</SelectItem>
                    <SelectItem value="inactive" className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">Inativo</SelectItem>
                    <SelectItem value="pending" className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleAddMember}
                disabled={loading || !newMember.name || !newMember.phone}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Adicionar Membro
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAddMember(false)}
                className="border-slate-600"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700 flex flex-wrap gap-1 p-1">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <BarChart3 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Testar Bot</span>
            </TabsTrigger>
            <TabsTrigger value="conversations" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <Phone className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Conversas</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Membros</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <Send className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Broadcast</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-300 hover:text-white px-4 py-2">
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Configurar</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Total Membros</CardTitle>
                  <Users className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.totalMembers}</div>
                  <p className="text-xs text-slate-500">cadastrados no sistema</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Conversas Ativas</CardTitle>
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.activeConversations}</div>
                  <p className="text-xs text-slate-500">em andamento</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Mensagens Hoje</CardTitle>
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.messagesToday}</div>
                  <p className="text-xs text-slate-500">processadas</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">Taxa de Resposta</CardTitle>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.responseRate}%</div>
                  <p className="text-xs text-slate-500">automáticas</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setActiveTab('chat')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Testar Bot
                  </Button>
                  <Button 
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                    onClick={() => setActiveTab('broadcast')}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Broadcast
                  </Button>
                  <Button 
                    className="w-full justify-start bg-purple-600 hover:bg-purple-700"
                    onClick={() => setShowAddMember(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Membros
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    Webhook WhatsApp
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Configure este URL no Meta Developers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-900 rounded-lg p-3 flex items-center gap-2">
                    <code className="text-xs text-emerald-400 flex-1 break-all">
                      {webhookUrl}
                    </code>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    1. Acesse developers.facebook.com<br/>
                    2. Vá em WhatsApp → Configuration<br/>
                    3. Adicione este URL como webhook<br/>
                    4. Use o Verify Token definido em .env
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-500" />
                  Testar Bot
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Envie mensagens para testar as respostas do bot
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Niche Selector */}
                <div className="mb-4">
                  <Label className="text-white font-medium mb-2 block">Nicho de Atuação</Label>
                  <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                    <SelectTrigger className="bg-slate-100 text-slate-900 border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-300">
                      {niches.map(n => (
                        <SelectItem key={n.id} value={n.id} className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">
                          {n.icon} {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chat Messages */}
                <ScrollArea className="h-[400px] border border-slate-700 rounded-lg p-4 mb-4 bg-slate-900">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                      <p>Envie uma mensagem para testar o bot</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              msg.direction === 'inbound'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {msg.isFromBot && (
                              <p className="text-xs text-emerald-400 mb-1 flex items-center gap-1">
                                <Bot className="w-3 h-3" /> Bot
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className="text-xs opacity-50 mt-1">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendTestMessage()}
                    className="bg-slate-900 border-slate-600 text-white"
                    disabled={loading}
                  />
                  <Button 
                    onClick={sendTestMessage}
                    disabled={loading || !inputMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-500" />
                      Conversas
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Gerencie as conversas ativas com seus contatos
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                    {conversations.length} conversas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma conversa ativa</p>
                    <p className="text-sm">As conversas aparecerão aqui quando o webhook receber mensagens</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => openConversation(conv)}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                            {conv.member?.name?.charAt(0) || <Phone className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {conv.member?.name || conv.phone}
                            </p>
                            <p className="text-xs text-slate-400">{conv.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {conv.humanTakeover ? (
                            <Badge variant="outline" className="border-blue-500 text-blue-400 text-xs">
                              Humano
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-400 text-xs">
                              Bot
                            </Badge>
                          )}
                          <Badge variant={conv.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {conv.status === 'active' ? 'Ativa' : 'Resolvida'}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      Membros
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Gerencie os contatos cadastrados
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowAddMember(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Buscar membros..."
                    value={searchMember}
                    onChange={e => setSearchMember(e.target.value)}
                    className="bg-slate-900 border-slate-600 pl-10"
                  />
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum membro cadastrado</p>
                    <p className="text-sm">Clique em "Adicionar" para cadastrar o primeiro membro</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members
                      .filter(m => 
                        !searchMember || 
                        m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
                        m.phone.includes(searchMember)
                      )
                      .map(member => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">{member.name}</p>
                              <p className="text-xs text-slate-400">{member.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.category && (
                              <Badge variant="outline" className="text-xs">
                                {member.category}
                              </Badge>
                            )}
                            <Badge 
                              variant={member.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {member.status === 'active' ? 'Ativo' : member.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Broadcast Tab */}
          <TabsContent value="broadcast" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-500" />
                  Enviar Broadcast
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Envie mensagens em massa para todos os membros ativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-white font-medium mb-2 block">Mensagem</Label>
                    <textarea
                      className="w-full h-32 rounded-lg bg-slate-900 border border-slate-600 p-3 text-white resize-none"
                      placeholder="Digite sua mensagem para envio em massa..."
                      value={broadcastMessage}
                      onChange={e => setBroadcastMessage(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400">Membros ativos que receberão:</span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                      {members.filter(m => m.status === 'active').length} contatos
                    </Badge>
                  </div>
                  
                  <Button 
                    onClick={sendBroadcast}
                    disabled={loading || !broadcastMessage.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar Broadcast
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-400" />
                  Configurações do Bot
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure o comportamento e personalidade do seu bot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bot Identity */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Bot className="w-4 h-4 text-emerald-500" />
                    Identidade do Bot
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white font-medium">Nome do Bot</Label>
                      <Input
                        value={botName}
                        onChange={e => setBotName(e.target.value)}
                        className="bg-slate-900 border-slate-600 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-white font-medium">Nicho</Label>
                      <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                        <SelectTrigger className="bg-slate-100 text-slate-900 border-slate-300 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-300">
                          {niches.map(n => (
                            <SelectItem key={n.id} value={n.id} className="text-slate-900 hover:bg-slate-100 focus:bg-slate-100">
                              {n.icon} {n.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-white font-medium">Mensagem de Boas-vindas</Label>
                    <textarea
                      className="w-full h-20 rounded-lg bg-slate-900 border border-slate-600 p-3 text-white resize-none mt-1"
                      value={welcomeMessage}
                      onChange={e => setWelcomeMessage(e.target.value)}
                    />
                  </div>
                </div>

                {/* Business Hours */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Clock4 className="w-4 h-4 text-blue-500" />
                    Horário de Atendimento
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white font-medium">Início</Label>
                      <Input
                        type="time"
                        value={businessHours.start}
                        onChange={e => setBusinessHours(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-slate-900 border-slate-600 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-white font-medium">Término</Label>
                      <Input
                        type="time"
                        value={businessHours.end}
                        onChange={e => setBusinessHours(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-slate-900 border-slate-600 mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white font-medium">Resposta Automática</Label>
                      <p className="text-xs text-slate-500">Bot responde automaticamente</p>
                    </div>
                    <Switch checked={autoReply} onCheckedChange={setAutoReply} />
                  </div>
                </div>

                {/* Tone */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <MessageCircle className="w-4 h-4 text-purple-500" />
                    Tom de Comunicação
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'professional', label: 'Profissional', desc: 'Formal' },
                      { id: 'friendly', label: 'Amigável', desc: 'Casual' },
                      { id: 'technical', label: 'Técnico', desc: 'Direto' }
                    ].map(tone => (
                      <button
                        key={tone.id}
                        onClick={() => setBotTone(tone.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          botTone === tone.id 
                            ? 'border-emerald-500 bg-emerald-500/20 text-white' 
                            : 'border-slate-500 bg-slate-700 hover:border-slate-400 text-white'
                        }`}
                      >
                        <p className="font-medium text-white">{tone.label}</p>
                        <p className="text-xs text-slate-300">{tone.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
