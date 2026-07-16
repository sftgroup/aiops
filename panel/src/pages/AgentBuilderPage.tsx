import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, api } from '../AuthContext'
import toast from 'react-hot-toast'
import { Bot, Plus, Play, Copy, Trash2, Upload, Eye, Loader2, MessageSquare, Sparkles, ArrowRight, Check, X, ChevronDown, RefreshCw } from 'lucide-react'

const ALL_SKILLS = [
  { name: 'aiops_content_generate', label: 'Content Generate', desc: 'Generate social media content for 7 platforms' },
  { name: 'aiops_tts_synthesize', label: 'TTS Synthesize', desc: 'Convert text to speech (14 languages)' },
  { name: 'aiops_tts_list_voices', label: 'TTS List Voices', desc: 'Discover available TTS voices' },
  { name: 'aiops_quota_check', label: 'Quota Check', desc: 'Check remaining API quotas' },
  { name: 'aiops_content_platforms', label: 'Content Platforms', desc: 'Get supported platform list' },
  { name: 'aiops_content_styles', label: 'Content Styles', desc: 'Get supported style list' },
  { name: 'aiops_dashboard_overview', label: 'Dashboard Overview', desc: 'Today usage statistics' },
]

interface Agent {
  id: string
  name: string
  description: string
  prompt: string
  skillList: string[]
  tags: string[]
  status: string
  createdAt: string
}

interface ExecutionResult {
  finalText: string
  toolCalls: { name: string; arguments: Record<string, unknown>; result: unknown; durationMs: number }[]
  totalIterations: number
  totalDuration: number
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export default function AgentBuilderPage() {
  const { t } = useTranslation('common')
  const { token } = useAuth()

  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [streamText, setStreamText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPrompt, setFormPrompt] = useState('')
  const [formSkills, setFormSkills] = useState<string[]>([])
  const [formTags, setFormTags] = useState('')
  const [creating, setCreating] = useState(false)

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    try {
      const data = await api(token).get('/agents')
      setAgents(data.agents || [])
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoadingAgents(false) }
  }, [token])

  const createAgent = async () => {
    if (!formName.trim() || !formPrompt.trim()) {
      toast.error('Name and Prompt are required')
      return
    }
    setCreating(true)
    try {
      const data = await api(token).post('/agents', {
        name: formName.trim(),
        description: formDesc.trim(),
        prompt: formPrompt.trim(),
        skillNames: formSkills,
        tags: formTags.split(',').map(s => s.trim()).filter(Boolean),
      })
      toast.success('Agent created')
      setShowCreate(false)
      setFormName(''); setFormDesc(''); setFormPrompt(''); setFormSkills([]); setFormTags('')
      await loadAgents()
      setSelectedAgent(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setCreating(false) }
  }

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    try {
      await api(token).del('/agents/' + id)
      toast.success('Agent deleted')
      if (selectedAgent?.id === id) { setSelectedAgent(null); setResult(null) }
      await loadAgents()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const runAgent = async () => {
    if (!selectedAgent || !testMessage.trim()) return
    setRunning(true)
    setResult(null)
    setStreamText('')
    try {
      const data = await api(token).post('/agents/' + selectedAgent.id + '/run', {
        message: testMessage.trim(),
        skillNames: selectedAgent.skillList || [],
      })
      setResult(data)
      setStreamText(data.finalText)
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setStreamText('Agent execution failed: ' + (e as Error).message)
    }
    finally { setRunning(false) }
  }

  const toggleSkill = (name: string) => {
    setFormSkills(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name])
  }

  React.useEffect(() => { loadAgents() }, [loadAgents])

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Agent Builder</h2>
            <p className="text-sm text-gray-500 mt-1">Create AI agents that autonomously complete multi-step tasks</p>
          </div>
          <button
            onClick={() => { setShowCreate(!showCreate); setSelectedAgent(null); setResult(null) }}
            className="px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Agent
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Create New Agent</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20"
                placeholder="e.g. Twitter Auto Poster"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Description</label>
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20"
                placeholder="What does this agent do?"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">System Prompt *</label>
              <textarea
                ref={textareaRef}
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                rows={6}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 resize-none"
                placeholder="You are a social media expert. When given a topic..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Skills ({formSkills.length} selected)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_SKILLS.map(skill => (
                  <button
                    key={skill.name}
                    onClick={() => toggleSkill(skill.name)}
                    className={`text-left p-3 rounded-lg border text-sm transition-all ${
                      formSkills.includes(skill.name)
                        ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary'
                        : 'border-dark-border bg-dark-bg text-gray-400 hover:border-dark-border/80 hover:text-gray-300'
                    }`}
                  >
                    <div className="font-medium">{skill.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{skill.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Tags (comma separated)</label>
              <input
                value={formTags}
                onChange={e => setFormTags(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50"
                placeholder="twitter, social-media, automation"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={createAgent}
                disabled={creating}
                className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Agent
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 border border-dark-border rounded-xl text-sm text-gray-400 hover:text-white hover:bg-dark-hover transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-80 shrink-0 bg-dark-card rounded-xl border border-dark-border overflow-y-auto">
          <div className="px-4 py-3 border-b border-dark-border">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-accent-primary" /> My Agents</h3>
          </div>
          {loadingAgents ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          ) : agents.length === 0 ? (
            <div className="p-6 text-center">
              <Bot className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No agents yet</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 px-3 py-1.5 bg-accent-primary/10 text-accent-primary rounded-lg text-xs hover:bg-accent-primary/20 transition-all">Create Your First Agent</button>
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  onClick={() => { setSelectedAgent(agent); setResult(null); setShowCreate(false) }}
                  className={`p-4 cursor-pointer transition-all hover:bg-dark-hover ${
                    selectedAgent?.id === agent.id ? 'bg-accent-primary/10 border-l-2 border-l-accent-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.description || 'No description'}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteAgent(agent.id) }}
                      className="ml-2 p-1 hover:bg-dark-hover rounded text-gray-500 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {agent.skillList && agent.skillList.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {agent.skillList.slice(0, 3).map((s: string) => (
                        <span key={s} className="px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary/80 rounded text-[10px]">{s.replace('aiops_', '')}</span>
                      ))}
                      {agent.skillList.length > 3 && <span className="text-[10px] text-gray-500">+{agent.skillList.length - 3}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {selectedAgent ? (
            <>
              <div className="bg-dark-card rounded-xl border border-dark-border p-5 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedAgent.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{selectedAgent.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedAgent.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {selectedAgent.status}
                  </span>
                </div>
                <div className="mt-4 p-4 bg-dark-bg rounded-lg border border-dark-border">
                  <p className="text-xs text-gray-500 mb-1 font-medium">System Prompt</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedAgent.prompt}</p>
                </div>
                {selectedAgent.skillList?.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {selectedAgent.skillList.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-accent-primary/10 text-accent-primary rounded text-xs font-mono">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-dark-card rounded-xl border border-dark-border p-5 flex-1 flex flex-col min-h-0">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-accent-primary" /> Test Chat</h4>
                <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                  {running && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
                      <span>Agent is thinking...</span>
                    </div>
                  )}
                  {streamText && (
                    <div className="p-4 bg-dark-bg rounded-lg border border-dark-border">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Response</p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{streamText}</p>
                    </div>
                  )}
                  {result && result.toolCalls && result.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-500 font-medium">Tool Calls ({result.toolCalls.length})</p>
                      {result.toolCalls.map((tc, i) => (
                        <div key={i} className="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-accent-primary font-mono">{tc.name}</span>
                            <span className="text-gray-500">{tc.durationMs}ms</span>
                          </div>
                          {tc.result && <p className="text-gray-400 mt-1 truncate">{JSON.stringify(tc.result).slice(0, 120)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {result && (
                    <div className="mt-3 text-xs text-gray-500 flex gap-4">
                      <span>{result.totalIterations} iterations</span>
                      <span>{(result.totalDuration / 1000).toFixed(1)}s</span>
                      <span>{result.usage.totalTokens} tokens</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent() } }}
                    className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50"
                    placeholder="e.g. Write a tweet about AI trends..."
                  />
                  <button
                    onClick={runAgent}
                    disabled={running || !testMessage.trim()}
                    className="px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-dark-card rounded-xl border border-dark-border">
              <div className="text-center py-12">
                <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">Select an agent or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
