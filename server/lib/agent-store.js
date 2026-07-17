// ---------------------------------------------------------------------------
// AIOps Agent Bridge — Agent Store (PostgreSQL CRUD)
// ---------------------------------------------------------------------------
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * Create a new Agent definition for a tenant.
 */
async function createAgent(tenantId, data) {
  const { name, description, prompt, skillNames, tags, pricing } = data
  const agent = await prisma.agentDefinition.create({
    data: {
      tenantId,
      name,
      description: description || '',
      prompt,
      pricing: pricing || {},
      tags: tags || [],
    },
  })

  // Save skill names as skillList
  if (skillNames && skillNames.length > 0) {
    await prisma.agentDefinition.update({
      where: { id: agent.id },
      data: { skillList: skillNames },
    })

    for (const name of skillNames) {
      await prisma.agentSkill.create({
        data: {
          agentId: agent.id,
          name,
          description: `AIOps built-in skill: ${name}`,
          inputSchema: {},
          outputSchema: {},
          executionType: 'open',
          executionConfig: {},
        },
      }).catch(() => { /* skill already exists */ })
    }
  }

  return agent
}

/**
 * Get all agents for a tenant.
 */
async function listAgents(tenantId, { page = 1, pageSize = 20, status = undefined }) {
  const where = { tenantId }
  if (status) where.status = status

  const [agents, total] = await Promise.all([
    prisma.agentDefinition.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { executions: true } } },
    }),
    prisma.agentDefinition.count({ where }),
  ])

  return { agents, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } }
}

/**
 * Get a single agent by ID (must belong to tenant).
 */
async function getAgent(tenantId, agentId) {
  return prisma.agentDefinition.findFirst({
    where: { id: agentId, tenantId },
    include: { _count: { select: { executions: true } } },
  })
}

/**
 * Update an agent.
 */
async function updateAgent(tenantId, agentId, data) {
  const existing = await prisma.agentDefinition.findFirst({ where: { id: agentId, tenantId } })
  if (!existing) return null

  return prisma.agentDefinition.update({
    where: { id: agentId },
    data: {
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      skillList: data.skillList,
      pricing: data.pricing,
      tags: data.tags,
      status: data.status,
    },
  })
}

/**
 * Delete an agent.
 */
async function deleteAgent(tenantId, agentId) {
  const existing = await prisma.agentDefinition.findFirst({ where: { id: agentId, tenantId } })
  if (!existing) return null

  await prisma.agentSkill.deleteMany({ where: { agentId } })
  await prisma.agentExecution.deleteMany({ where: { agentId } })
  await prisma.agentPublication.deleteMany({ where: { agentId } })
  await prisma.agentDefinition.delete({ where: { id: agentId } })
  return existing
}

/**
 * Record an agent execution.
 */
async function recordExecution(agentId, userId, { input, output, iterations, durationMs, tokensUsed, status = 'completed' }) {
  return prisma.agentExecution.create({
    data: {
      agentId,
      userId: userId || null,
      input,
      output,
      iterations,
      durationMs,
      tokensUsed,
      status,
    },
  })
}

/**
 * Get execution history for an agent.
 */
async function listExecutions(agentId, { page = 1, pageSize = 20 }) {
  const [executions, total] = await Promise.all([
    prisma.agentExecution.findMany({
      where: { agentId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agentExecution.count({ where: { agentId } }),
  ])

  return { executions, pagination: { page, pageSize, total } }
}

/**
 * Publish agent to marketplace.
 */
async function publishAgent(tenantId, agentId, { category = 'general', price = 0 }) {
  const existing = await prisma.agentDefinition.findFirst({ where: { id: agentId, tenantId } })
  if (!existing) return null

  // Mark as published
  await prisma.agentDefinition.update({
    where: { id: agentId },
    data: { status: 'published' },
  })

  // Upsert publication record
  return prisma.agentPublication.upsert({
    where: { agentId },
    update: { public: true, category, price },
    create: { agentId, public: true, category, price },
  })
}

/**
 * Search published agents on the marketplace.
 */
async function searchMarketplace({ keyword, category, page = 1, pageSize = 20, sortBy = 'latest' }) {
  const where = {
    status: 'published',
    publication: { public: true },
  }

  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ]
  }
  if (category) {
    where.publication = { ...where.publication, category }
  }

  const orderBy = sortBy === 'popular' ? { usageCount: 'desc' } : sortBy === 'rating' ? { rating: 'desc' } : { updatedAt: 'desc' }

  const [agents, total] = await Promise.all([
    prisma.agentDefinition.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        usageCount: true,
        rating: true,
        createdAt: true,
        tenantId: true,
      },
    }),
    prisma.agentDefinition.count({ where }),
  ])

  return { agents, pagination: { page, pageSize, total } }
}

/**
 * Clone a marketplace agent to the user's own tenant.
 */
async function cloneAgent(tenantId, agentId) {
  const source = await prisma.agentDefinition.findFirst({
    where: { id: agentId, status: 'published' },
  })
  if (!source) return null

  const cloned = await prisma.agentDefinition.create({
    data: {
      tenantId,
      name: `${source.name} (Clone)`,
      description: source.description,
      prompt: source.prompt,
      skillList: source.skillList,
      pricing: source.pricing,
      tags: source.tags,
      status: 'draft',
    },
  })

  // Increment usage count on source
  await prisma.agentDefinition.update({
    where: { id: agentId },
    data: { usageCount: { increment: 1 } },
  })

  return cloned
}

module.exports = {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
  recordExecution,
  listExecutions,
  publishAgent,
  searchMarketplace,
  cloneAgent,
}
