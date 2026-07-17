import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, api } from '../AuthContext'
import toast from 'react-hot-toast'
import { Search, Store, Download, Star, Tag, Clock, Bot } from 'lucide-react'

interface MarketAgent {
  id: string
  name: string
  description: string
  tags: string[]
  usageCount: number
  rating: number
  createdAt: string
}

const CATEGORIES = ['all', 'social-media', 'content', 'tts', 'automation', 'analytics', 'general']

export default function MarketplacePage() {
  const { t } = useTranslation('common')
  const { token } = useAuth()

  const [agents, setAgents] = useState<MarketAgent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 12

  const loadMarketplace = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
        sortBy: 'latest',
      })
      if (search.trim()) params.set('keyword', search.trim())
      if (category !== 'all') params.set('category', category)

      const data = await api(token).get('/agents/marketplace/search?' + params.toString())
      setAgents(data.agents || [])
      setTotal(data.pagination?.total || 0)
      setPage(p)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [token, search, category])

  const cloneAgent = async (agentId: string) => {
    try {
      await api(token).post('/agents/' + agentId + '/clone', {})
      toast.success('Agent cloned to your workspace')
      loadMarketplace(page)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  React.useEffect(() => { loadMarketplace(1) }, [loadMarketplace])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Agent Marketplace</h2>
            <p className="text-sm text-gray-500 mt-1">Discover AI agents created by the community</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadMarketplace(1) }}
            className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent-primary/50"
            placeholder="Search agents..."
          />
        </div>
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                category === cat
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white hover:border-dark-border/80'
              }`}
            >
              {cat === 'all' ? 'All' : cat.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-dark-card rounded-xl border border-dark-border p-5 animate-pulse">
                <div className="h-4 bg-dark-hover rounded w-3/4 mb-3" />
                <div className="h-3 bg-dark-hover rounded w-full mb-2" />
                <div className="h-3 bg-dark-hover rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex items-center justify-center h-64 bg-dark-card rounded-xl border border-dark-border">
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No agents found</p>
              <p className="text-xs text-gray-600 mt-1">Try a different search or category</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div key={agent.id} className="bg-dark-card rounded-xl border border-dark-border p-5 hover:border-accent-primary/30 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-accent-primary" />
                    </div>
                    <button
                      onClick={() => cloneAgent(agent.id)}
                      className="px-2.5 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-gray-400 hover:text-accent-primary hover:border-accent-primary/30 transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3 h-3" /> Clone
                    </button>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{agent.name}</h3>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{agent.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {agent.rating?.toFixed(1) || '—'}</span>
                    <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {agent.usageCount || 0}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(agent.createdAt).toLocaleDateString()}</span>
                  </div>
                  {agent.tags && agent.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {agent.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px] text-gray-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => loadMarketplace(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      page === i + 1
                        ? 'bg-accent-primary text-white'
                        : 'bg-dark-card border border-dark-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
