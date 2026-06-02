import { getApiKey } from './storage'
import { API_ENDPOINTS } from './constants'

function getHeaders() {
  const key = getApiKey()
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  }
}

export async function apiFetch(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error?.message || error.error || `Request failed: ${response.status}`)
  }

  return response.json()
}

export async function fetchModels() {
  const data = await apiFetch(API_ENDPOINTS.MODELS)
  return data.data || []
}

export async function verifyKey(key) {
  const response = await fetch(API_ENDPOINTS.VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: key }),
  })
  return response.ok
}

export async function fetchAccounts() {
  return apiFetch(API_ENDPOINTS.GET_ALL_ACCOUNTS)
}

export async function addAccount(email, password) {
  return apiFetch(API_ENDPOINTS.SET_ACCOUNT, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function deleteAccount(email) {
  return apiFetch(API_ENDPOINTS.DELETE_ACCOUNT, {
    method: 'DELETE',
    body: JSON.stringify({ email }),
  })
}

export async function refreshAccount(email) {
  return apiFetch(API_ENDPOINTS.REFRESH_ACCOUNT, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function refreshAllAccounts() {
  return apiFetch(API_ENDPOINTS.REFRESH_ALL_ACCOUNTS, {
    method: 'POST',
  })
}

export async function setAccountDisabled(email, disabled) {
  return apiFetch('/api/disableAccount', {
    method: 'POST',
    body: JSON.stringify({ email, disabled }),
  })
}

/**
 * Manually push the current in-memory accounts / proxies / disabled list
 * to the Vercel project's env vars.
 */
export async function vercelSyncNow(scopes) {
  return apiFetch('/api/vercel/syncNow', {
    method: 'POST',
    body: JSON.stringify({ scopes: scopes || 'all' }),
  })
}

/* ----- smart proxy pool ----- */

export async function fetchProxies() {
  const data = await apiFetch('/api/proxy/status')
  return data.data || []
}

export async function addProxy(url) {
  return apiFetch('/api/proxy/add', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export async function removeProxy(url) {
  return apiFetch('/api/proxy', {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  })
}

/**
 * Stream chat with support for reasoning_content and content
 * 关键优化：
 * 1. 首字节到达立即调用 onChunk，不等待完整行解析
 * 2. 按 \n\n 分块（OpenAI SSE 标准），避免 split('\n') 浪费
 * 3. 错误处理更稳健
 *
 * @param {Array} messages
 * @param {string} model
 * @param {Function} onChunk - (content, type) where type is 'content' or 'reasoning'
 * @param {Function} onDone
 * @param {AbortSignal} signal
 * @param {Object} extraParams
 */
export async function streamChat(messages, model, onChunk, onDone, signal, extraParams = {}) {
  const key = getApiKey()
  const response = await fetch(API_ENDPOINTS.CHAT_COMPLETIONS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...extraParams,
    }),
    signal,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error?.message || error.error || `Request failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // 解码当前 chunk
    buffer += decoder.decode(value, { stream: true })

    // 按 SSE 事件边界 (双换行) 切分，比 split('\n') 更准确且更快
    let boundaryIdx
    while ((boundaryIdx = buffer.indexOf('\n\n')) !== -1) {
      const eventBlock = buffer.slice(0, boundaryIdx)
      buffer = buffer.slice(boundaryIdx + 2)

      // 解析这个事件块中的所有 data: 行
      const lines = eventBlock.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          onDone?.()
          return
        }
        if (!data) continue
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
          if (!delta) continue
          if (delta.reasoning_content) {
            onChunk(delta.reasoning_content, 'reasoning')
          }
          if (delta.content) {
            onChunk(delta.content, 'content')
          }
        } catch {
          // 忽略不完整的 JSON 块，等待下一个 chunk
        }
      }
    }
  }

  // 处理最后残余的 buffer（可能没有 \n\n 结束）
  if (buffer.trim()) {
    const lines = buffer.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') break
      if (!data) continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content) onChunk(delta.reasoning_content, 'reasoning')
        if (delta.content) onChunk(delta.content, 'content')
      } catch { /* ignore */ }
    }
  }

  onDone?.()
}
