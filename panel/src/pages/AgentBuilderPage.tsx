import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, api } from '../AuthContext'
import toast from 'react-hot-toast'
import { Bot, Plus, Play, Copy, Trash2, Upload, Loader2, MessageSquare, Check, X, ChevronDown, Code, Workflow, Eye, Wand2 } from 'lucide-react'

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
  id: string; name: string; description: string; prompt: string; skillList: string[]; tags: string[]; status: string; createdAt: string
}

interface ExecutionResult {
  finalText: string; toolCalls: { name: string; arguments: Record<string, unknown>; result: unknown; durationMs: number }[]; totalIterations: number; totalDuration: number; usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

interface WorkflowStepResult { stepId: string; tool: string; status: string; durationMs: number; output?: unknown; error?: string }
interface WorkflowRunResult { name: string; status: string; totalDurationMs: number; steps: Record<string, unknown>; stepResults: WorkflowStepResult[] }

type ActiveTab = 'react' | 'workflow'

export default function AgentBuilderPage() {
  const { t } = useTranslation('common')
  const { token } = useAuth()

  // Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('react')

  // ReAct state
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [streamText, setStreamText] = useState('')
  const [formName, setFormName] = useState(''); const [formDesc, setFormDesc] = useState(''); const [formPrompt, setFormPrompt] = useState(''); const [formSkills, setFormSkills] = useState<string[]>([]); const [formTags, setFormTags] = useState(''); const [creating, setCreating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Workflow state
  const [workflowJson, setWorkflowJson] = useState('')
  const [workflowPresets, setWorkflowPresets] = useState<Record<string, unknown>[]>([])
  const [workflowVars, setWorkflowVars] = useState('')
  const [wfRunning, setWfRunning] = useState(false)
  const [wfResult, setWfResult] = useState<WorkflowRunResult | null>(null)
  const [presetsLoaded, setPresetsLoaded] = useState(false)

  // ── ReAct functions ─────────────────────────────────────────────────
  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    try { const data = await api(token).get('/agents'); setAgents(data.agents || []) } catch (e) { toast.error((e as Error).message) } finally { setLoadingAgents(false) }
  }, [token])

  const createAgent = async () => {
    if (!formName.trim() || !formPrompt.trim()) { toast.error('Name and Prompt are required'); return }
    setCreating(true)
    try {
      const data = await api(token).post('/agents', { name: formName.trim(), description: formDesc.trim(), prompt: formPrompt.trim(), skillNames: formSkills, tags: formTags.split(',').map((s: string) => s.trim()).filter(Boolean) })
      toast.success('Agent created'); setShowCreate(false); setFormName(''); setFormDesc(''); setFormPrompt(''); setFormSkills([]); setFormTags('')
      await loadAgents(); setSelectedAgent(data)
    } catch (e) { toast.error((e as Error).message) } finally { setCreating(false) }
  }

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    try { await api(token).del('/agents/' + id); toast.success('Agent deleted'); if (selectedAgent?.id === id) { setSelectedAgent(null); setResult(null) }; await loadAgents() } catch (e) { toast.error((e as Error).message) }
  }

  const runAgent = async () => {
    if (!selectedAgent || !testMessage.trim()) return
    setRunning(true); setResult(null); setStreamText('')
    try {
      const data = await api(token).post('/agents/' + selectedAgent.id + '/run', { message: testMessage.trim(), skillNames: selectedAgent.skillList || [] })
      setResult(data); setStreamText(data.finalText)
    } catch (e) { toast.error((e as Error).message); setStreamText('Agent execution failed: ' + (e as Error).message) } finally { setRunning(false) }
  }

  const toggleSkill = (name: string) => { setFormSkills(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]) }

  React.useEffect(() => { loadAgents() }, [loadAgents])

  // ── Workflow functions ──────────────────────────────────────────────
  const loadPresets = async () => {
    if (presetsLoaded) return
    try {
      const data = await api(token).get('/agents/workflow/presets')
      const presets = Object.entries(data.presets || {}).map(([key, val]: [string, unknown]) => ({ key, ...(val as Record<string, unknown>) }))
      setWorkflowPresets(presets)
      setWorkflowJson(JSON.stringify(data.template, null, 2))
      setPresetsLoaded(true)
    } catch (e) { /* ignore */ }
  }

  React.useEffect(() => { if (activeTab === 'workflow') loadPresets() }, [activeTab])

  const selectPreset = (preset: Record<string, unknown>) => {
    const { key, name, description, ...rest } = preset
    setWorkflowJson(JSON.stringify({ name, description, steps: (rest as { steps: unknown[] }).steps }, null, 2))
  }

  const runWorkflow = async () => {
    let workflow
    try { workflow = JSON.parse(workflowJson) } catch { toast.error('Invalid JSON'); return }
    if (!workflow.steps?.length) { toast.error('No steps defined'); return }

    let variables = {}
    try { if (workflowVars.trim()) variables = JSON.parse(workflowVars) } catch { toast.error('Invalid variables JSON'); return }

    setWfRunning(true); setWfResult(null)
    try {
      const data = await api(token).post('/agents/workflow/run', { workflow, variables })
      setWfResult(data)
    } catch (e) { toast.error((e as Error).message) } finally { setWfRunning(false) }
  }

  const formatToolName = (name: string) => name.replace('aiops_', '').replace(/_/g, ' ')

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Agent Builder</h2>
            <p className="text-sm text-gray-500 mt-1">Create AI agents or define JSON workflows for multi-step automation</p>
          </div>
          <div className="flex bg-dark-card rounded-xl border border-dark-border p-0.5 gap-0.5">
            <button onClick={() => setActiveTab('react')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'react' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'}`}>
              <Bot className="w-4 h-4" /> ReAct Agent
            </button>
            <button onClick={() => setActiveTab('workflow')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'workflow' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'}`}>
              <Workflow className="w-4 h-4" /> YAML Workflow
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ReAct Tab ═══ */}
      {activeTab === 'react' && (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-80 shrink-0 bg-dark-card rounded-xl border border-dark-border overflow-y-auto">
            <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-accent-primary" /> My Agents</h3>
              <button onClick={() => { setShowCreate(!showCreate); setSelectedAgent(null); setResult(null) }} className="px-2.5 py-1 bg-accent-primary/10 text-accent-primary rounded-lg text-xs hover:bg-accent-primary/20 transition-all flex items-center gap-1">
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
            {loadingAgents ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : agents.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No agents yet</p>
                <button onClick={() => setShowCreate(true)} className="mt-3 px-3 py-1.5 bg-accent-primary/10 text-accent-primary rounded-lg text-xs hover:bg-accent-primary/20">Create Agent</button>
              </div>
            ) : (
              <div className="divide-y divide-dark-border">
                {agents.map(agent => (
                  <div key={agent.id} onClick={() => { setSelectedAgent(agent); setResult(null); setShowCreate(false) }}
                    className={`p-4 cursor-pointer transition-all hover:bg-dark-hover ${selectedAgent?.id === agent.id ? 'bg-accent-primary/10 border-l-2 border-l-accent-primary' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.description || 'No description'}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteAgent(agent.id) }} className="ml-2 p-1 hover:bg-dark-hover rounded text-gray-500 hover:text-red-400 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {agent.skillList?.length > 0 && (
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
            {showCreate ? (
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 overflow-y-auto flex-1">
                <h3 className="font-semibold text-lg mb-4">Create New Agent</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
                    <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20" placeholder="e.g. Twitter Auto Poster" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                    <input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50" placeholder="What does this agent do?" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">System Prompt *</label>
                    <textarea value={formPrompt} onChange={e => setFormPrompt(e.target.value)} rows={6} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50 resize-none" placeholder="You are a social media expert..." />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Skills ({formSkills.length} selected)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ALL_SKILLS.map(skill => (
                        <button key={skill.name} onClick={() => toggleSkill(skill.name)}
                          className={`text-left p-3 rounded-lg border text-sm transition-all ${formSkills.includes(skill.name) ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary' : 'border-dark-border bg-dark-bg text-gray-400 hover:border-dark-border/80'}`}>
                          <div className="font-medium">{skill.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{skill.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Tags (comma separated)</label>
                    <input value={formTags} onChange={e => setFormTags(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50" placeholder="twitter, automation" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={createAgent} disabled={creating} className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create
                    </button>
                    <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-dark-border rounded-xl text-sm text-gray-400 hover:text-white hover:bg-dark-hover transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            ) : selectedAgent ? (
              <>
                <div className="bg-dark-card rounded-xl border border-dark-border p-5 mb-4">
                  <div className="flex items-start justify-between">
                    <div><h3 className="font-semibold text-lg">{selectedAgent.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{selectedAgent.description}</p></div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${selectedAgent.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>{selectedAgent.status}</span>
                  </div>
                  <div className="mt-4 p-4 bg-dark-bg rounded-lg border border-dark-border">
                    <p className="text-xs text-gray-500 mb-1 font-medium">System Prompt</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedAgent.prompt}</p>
                  </div>
                  {selectedAgent.skillList?.length > 0 && (
                    <div className="flex gap-1.5 mt-3 flex-wrap">{selectedAgent.skillList.map((s: string) => (<span key={s} className="px-2 py-0.5 bg-accent-primary/10 text-accent-primary rounded text-xs font-mono">{s}</span>))}</div>
                  )}
                </div>
                <div className="bg-dark-card rounded-xl border border-dark-border p-5 flex-1 flex flex-col min-h-0">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-accent-primary" /> Test Chat (ReAct)</h4>
                  <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                    {running && (<div className="flex items-center gap-2 text-sm text-gray-400 p-4"><Loader2 className="w-4 h-4 animate-spin text-accent-primary" /> Agent is thinking...</div>)}
                    {streamText && (<div className="p-4 bg-dark-bg rounded-lg border border-dark-border"><p className="text-xs text-gray-500 mb-1 font-medium">Response</p><p className="text-sm text-gray-200 whitespace-pre-wrap">{streamText}</p></div>)}
                    {result?.toolCalls?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Tool Calls ({result.toolCalls.length})</p>
                        {result.toolCalls.map((tc, i) => (
                          <div key={i} className="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs">
                            <div className="flex items-center gap-2"><span className="text-accent-primary font-mono">{tc.name}</span><span className="text-gray-500">{tc.durationMs}ms</span></div>
                            {tc.result && <p className="text-gray-400 mt-1 truncate">{JSON.stringify(tc.result).slice(0, 120)}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {result && (<div className="mt-3 text-xs text-gray-500 flex gap-4"><span>{result.totalIterations} iterations</span><span>{(result.totalDuration / 1000).toFixed(1)}s</span><span>{result.usage.totalTokens} tokens</span></div>)}
                  </div>
                  <div className="flex gap-2">
                    <input value={testMessage} onChange={e => setTestMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent() } }}
                      className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50" placeholder="e.g. Write a tweet about AI trends..." />
                    <button onClick={runAgent} disabled={running || !testMessage.trim()} className="px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2">
                      {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-dark-card rounded-xl border border-dark-border">
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">Select an agent or create a new one</p>
                  <p className="text-xs text-gray-600 mt-1">Agents use ReAct mode — LLM autonomously decides what steps to take</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Workflow Tab ═══ */}
      {activeTab === 'workflow' && (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-72 shrink-0 bg-dark-card rounded-xl border border-dark-border overflow-y-auto">
            <div className="px-4 py-3 border-b border-dark-border">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-accent-primary" /> Preset Templates</h3>
            </div>
            <div className="divide-y divide-dark-border">
              {workflowPresets.map((preset: Record<string, unknown>) => (
                <button key={preset.key as string} onClick={() => selectPreset(preset)}
                  className="w-full text-left p-4 hover:bg-dark-hover transition-all group">
                  <p className="text-sm font-medium group-hover:text-accent-primary transition-colors">{preset.name as string}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preset.description as string}</p>
                  <div className="flex gap-1 mt-2">
                    {(preset.steps as unknown[])?.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px] text-gray-500">{(preset.steps as unknown[]).length} steps</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="bg-dark-card rounded-xl border border-dark-border p-5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Code className="w-4 h-4 text-accent-primary" /> Workflow Definition (JSON)</h3>
                <button
                  onClick={runWorkflow}
                  disabled={wfRunning}
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2"
                >
                  {wfRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Execute
                </button>
              </div>
              <textarea
                value={workflowJson}
                onChange={e => setWorkflowJson(e.target.value)}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg p-4 text-sm text-gray-200 font-mono focus:outline-none focus:border-accent-primary/50 resize-none min-h-[280px]"
                placeholder='{ "name": "...", "steps": [...] }'
                spellCheck={false}
              />
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Input Variables (JSON, optional)</label>
                <input
                  value={workflowVars}
                  onChange={e => setWorkflowVars(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50"
                  placeholder='{ "topic": "AI trends", "language": "en-US", "voice": "en-US-JennyNeural" }'
                  spellCheck={false}
                />
              </div>
            </div>

            {wfResult && (
              <div className="bg-dark-card rounded-xl border border-dark-border p-5 overflow-y-auto max-h-[50vh]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent-primary" /> Results
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    wfResult.status === 'success' ? 'bg-green-500/10 text-green-400' : wfResult.status === 'partial' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {wfResult.status} · {(wfResult.totalDurationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="space-y-3">
                  {wfResult.stepResults.map((step: WorkflowStepResult) => (
                    <div key={step.stepId} className={`p-4 rounded-lg border text-sm transition-all ${
                      step.status === 'completed' ? 'bg-dark-bg border-dark-border' :
                      step.status === 'failed' ? 'bg-red-500/5 border-red-500/20' : 'bg-dark-bg/50 border-dark-border/50'
                    }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          step.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {step.status === 'completed' ? <Check className="w-3 h-3" /> : step.status === 'failed' ? <X className="w-3 h-3" /> : '—'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-200">{step.stepId}</p>
                          <p className="text-xs text-gray-500">{formatToolName(step.tool)} · {step.durationMs}ms</p>
                        </div>
                      </div>
                      {step.error ? (
                        <p className="text-xs text-red-400 pl-9">{step.error}</p>
                      ) : step.output ? (
                        <pre className="text-xs text-gray-400 pl-9 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{JSON.stringify(step.output, null, 2).slice(0, 400)}</pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
