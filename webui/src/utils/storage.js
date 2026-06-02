import { STORAGE_KEYS } from './constants'

// localStorage 安全限制（约 4MB）
const MAX_STORAGE_SIZE = 4 * 1024 * 1024
const MAX_SINGLE_CONVERSATION_SIZE = 1 * 1024 * 1024

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
}

export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key)
}

export function removeApiKey() {
  localStorage.removeItem(STORAGE_KEYS.API_KEY)
}

export function getConversations() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveConversations(conversations) {
  try {
    // 优化对话数据，移除过大的附件
    const optimizedConversations = conversations.map(conv => ({
      ...conv,
      messages: conv.messages?.map(msg => {
        if (!msg.attachments || msg.attachments.length === 0) {
          return msg
        }
        
        // 检查附件大小，如果过大则清理
        const optimizedAttachments = msg.attachments.map(att => {
          // 如果是大图片且已经发送成功，可以考虑不保存完整数据
          if (att.type === 'image' && att.data && att.data.length > 100 * 1024) {
            // 保留基本信息，移除大数据
            return {
              ...att,
              data: att.data.substring(0, 100) + '...', // 保留一小部分作为标识
              isTruncated: true
            }
          }
          return att
        })
        
        return { ...msg, attachments: optimizedAttachments }
      }) || []
    }))
    
    const jsonData = JSON.stringify(optimizedConversations)
    
    // 检查大小
    if (jsonData.length > MAX_STORAGE_SIZE) {
      console.warn('对话历史过大，清理旧对话')
      // 如果太大，只保留最近的 10 个对话
      const trimmed = optimizedConversations.slice(-10)
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(trimmed))
    } else {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, jsonData)
    }
  } catch (error) {
    console.error('保存对话历史失败:', error)
    // 如果保存失败，尝试清理并保存
    try {
      const trimmed = conversations.slice(-5) // 只保留 5 个
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(trimmed))
    } catch {
      // 最坏情况：清空存储
      localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS)
    }
  }
}

export function getActiveConversationId() {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION) || null
}

export function setActiveConversationId(id) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, id)
}

export function getSelectedModel() {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || ''
}

export function setSelectedModel(model) {
  localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, model)
}

export function getEnableThinking() {
  return localStorage.getItem(STORAGE_KEYS.ENABLE_THINKING) === '1'
}

export function setEnableThinking(on) {
  localStorage.setItem(STORAGE_KEYS.ENABLE_THINKING, on ? '1' : '0')
}

export function getEnableSearch() {
  return localStorage.getItem(STORAGE_KEYS.ENABLE_SEARCH) === '1'
}

export function setEnableSearch(on) {
  localStorage.setItem(STORAGE_KEYS.ENABLE_SEARCH, on ? '1' : '0')
}
