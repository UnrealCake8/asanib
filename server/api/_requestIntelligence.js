const ROUTING_CATEGORIES = ['Home services', 'Send & errands', 'Auto services', 'Beauty', 'Local services']

function clean(value, max = 220) {
  return String(value || '').trim().slice(0, max)
}

function fallbackClassification(request) {
  const q = `${request.query || ''}`.toLowerCase()
  let category = 'Local services'
  if (/\b(package|deliver(?:y|ed|ing)?|courier|collect(?:ion)?|pickup|drop[ -]?off|errand|move|moving|parcel)\b/.test(q)) category = 'Send & errands'
  else if (/\b(ac|a\/c|air\s*condition(?:er|ing)?|clean(?:er|ing)?|plumb(?:er|ing)?|electric(?:ian|al)?|handyman|maintenance)\b/.test(q)) category = 'Home services'
  else if (/\b(car|vehicle|tyre|tire|battery|car\s*wash|roadside|mechanic)\b/.test(q)) category = 'Auto services'
  else if (/\b(salon|beauty|hair|nail|makeup|barber|massage)\b/.test(q)) category = 'Beauty'
  return {
    category,
    summary: `${category}${request.location ? ` near ${request.location}` : ''}`,
    serviceTags: [],
    confidence: 0.45,
    source: 'fallback',
  }
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string' && content.text.trim()) return content.text
    }
  }
  return ''
}

async function callOpenAI(input, schemaName, schema) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.OPENAI_ROUTING_MODEL || 'gpt-5.6-luna'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'none' },
      instructions: 'You are Asanib request routing. Return only the requested structured data. Never invent a location, budget, provider capability, or availability. Choose the closest category from the allowed list.',
      input: JSON.stringify(input),
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI routing failed with ${response.status}`)
  const payload = await response.json()
  const text = extractResponseText(payload)
  if (!text) throw new Error('OpenAI routing returned no structured output.')
  return JSON.parse(text)
}

export async function classifyServiceRequest(request) {
  const fallback = fallbackClassification(request)
  if (!process.env.OPENAI_API_KEY) return fallback
  try {
    const result = await callOpenAI({
      task: 'Classify this UAE local-service request for marketplace routing.',
      allowedCategories: ROUTING_CATEGORIES,
      request: {
        query: clean(request.query, 700),
        location: clean(request.location, 160),
        urgency: clean(request.urgency, 20),
        scheduledFor: clean(request.scheduledFor, 80) || null,
        budget: request.budget ?? null,
      },
    }, 'asanib_request_classification', {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: 'string', enum: ROUTING_CATEGORIES },
        summary: { type: 'string', minLength: 1, maxLength: 180 },
        serviceTags: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 40 } },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['category', 'summary', 'serviceTags', 'confidence'],
    })
    return {
      category: ROUTING_CATEGORIES.includes(result.category) ? result.category : fallback.category,
      summary: clean(result.summary, 180) || fallback.summary,
      serviceTags: Array.isArray(result.serviceTags) ? result.serviceTags.map((tag) => clean(tag, 40)).filter(Boolean).slice(0, 8) : [],
      confidence: Number.isFinite(Number(result.confidence)) ? Math.max(0, Math.min(1, Number(result.confidence))) : 0.5,
      source: 'llm',
    }
  } catch (error) {
    console.warn('Asanib LLM classification fallback:', error instanceof Error ? error.message : error)
    return fallback
  }
}

export async function rankProvidersForRequest(request, providers) {
  if (!process.env.OPENAI_API_KEY || providers.length < 2) return providers
  const candidates = providers.slice(0, 30)
  try {
    const result = await callOpenAI({
      task: 'Rank already-eligible verified providers for this service request. Only use the supplied business categories and service areas. Do not include providers that are not in candidates.',
      request: {
        query: clean(request.query, 700),
        category: clean(request.category, 80),
        serviceTags: Array.isArray(request.serviceTags) ? request.serviceTags : [],
        location: clean(request.location, 160),
        urgency: clean(request.urgency, 20),
      },
      candidates: candidates.map((provider) => ({
        id: provider.id,
        categories: Array.isArray(provider.categories) ? provider.categories.slice(0, 20) : [],
        areas: Array.isArray(provider.areas) ? provider.areas.slice(0, 30) : [],
        availableNow: provider.availableNow === true,
      })),
    }, 'asanib_provider_ranking', {
      type: 'object',
      additionalProperties: false,
      properties: {
        providerIds: {
          type: 'array',
          maxItems: 30,
          items: { type: 'string', minLength: 1, maxLength: 160 },
        },
      },
      required: ['providerIds'],
    })
    const byId = new Map(candidates.map((provider) => [provider.id, provider]))
    const ranked = []
    for (const id of Array.isArray(result.providerIds) ? result.providerIds : []) {
      const provider = byId.get(String(id))
      if (provider) {
        ranked.push(provider)
        byId.delete(String(id))
      }
    }
    return [...ranked, ...byId.values(), ...providers.slice(30)]
  } catch (error) {
    console.warn('Asanib LLM provider ranking fallback:', error instanceof Error ? error.message : error)
    return providers
  }
}
