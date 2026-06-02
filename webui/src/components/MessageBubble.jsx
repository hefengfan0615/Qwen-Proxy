import { useState, useMemo, useCallback } from 'react'
import { parseMessageContent, renderMarkdown } from '../utils/markdown'
import ThinkingBlock from './ThinkingBlock'

export default function MessageBubble({
  message,
  isStreaming = false,
  onRetry,
  onSwitchVersion,
  showRetry = false,
}) {
  const [copied, setCopied] = useState(false)
  const [imageErrors, setImageErrors] = useState({})
  const isUser = message.role === 'user'
  const isError = message.isError

  // 版本信息（仅 assistant 消息）
  const versions = Array.isArray(message.versions) ? message.versions : null
  const versionCount = versions ? versions.length : 0
  const versionIndex = versionCount > 0
    ? Math.min(message.versionIndex ?? versionCount - 1, versionCount - 1)
    : 0
  const activeVersion = versionCount > 0 ? versions[versionIndex] : null

  // 使用 useMemo 缓存派生内容，避免每次渲染重新计算
  const { thinking, mainContent, html } = useMemo(() => {
    if (isUser) {
      return { thinking: null, mainContent: message.content ?? '', html: '' }
    }

    let t = activeVersion?.reasoning_content ?? message.reasoning_content ?? null
    let m = activeVersion?.content ?? message.content ?? ''
    let h = ''

    if (!t && m) {
      const parsed = parseMessageContent(m)
      t = parsed.thinking
      m = m.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }
    h = renderMarkdown(m)

    return { thinking: t, mainContent: m, html: h }
  }, [isUser, activeVersion, message.content, message.reasoning_content])

  const handleCopy = useCallback(async () => {
    const text = activeVersion?.content ?? message.content ?? ''
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 降级方案
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeVersion, message.content])

  const handleImageError = useCallback((index) => {
    setImageErrors(prev => ({ ...prev, [index]: true }))
  }, [])

  // 用户消息文本：限制超长文本溢出
  const userText = useMemo(() => {
    if (isUser && typeof message.content === 'string' && message.content.length > 10000) {
      return message.content.substring(0, 10000) + '...'
    }
    return message.content
  }, [isUser, message.content])

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mt-1">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}

      {/* Message content - 使用 min-w-0 防止 flex 子项溢出 */}
      <div className={`min-w-0 max-w-[80%] group relative ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl break-words overflow-hidden ${
            isUser
              ? 'bg-accent-primary/15 border border-accent-primary/20 text-slate-200'
              : isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
              : 'glass-card text-slate-200'
          }`}
        >
          {isUser ? (
            <>
              {userText && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed break-words overflow-wrap-anywhere">
                  {userText}
                </p>
              )}
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap max-w-full">
                  {message.attachments.map((att, i) => (
                    att.type === 'image' ? (
                      <div key={i} className="relative max-w-full">
                        {att.isTruncated || imageErrors[i] ? (
                          <div className="h-20 w-20 p-2 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center">
                            <span className="text-[10px] text-slate-500 text-center leading-tight">
                              {att.isTruncated ? '已归档' : '加载失败'}
                            </span>
                          </div>
                        ) : (
                          <img
                            key={i}
                            src={att.data}
                            className="h-20 w-20 rounded-lg object-cover border border-white/10"
                            loading="lazy"
                            decoding="async"
                            onError={() => handleImageError(i)}
                            alt={att.name || '附件图片'}
                          />
                        )}
                      </div>
                    ) : (
                      <span key={i} className="text-xs text-slate-400 inline-flex items-center gap-1 max-w-[150px] truncate">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate">{att.name}</span>
                      </span>
                    )
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <ThinkingBlock content={thinking} />
              <div
                className="markdown-body text-sm break-words overflow-wrap-anywhere"
                dangerouslySetInnerHTML={{ __html: html || (isStreaming ? '<span class="animate-pulse-soft">▊</span>' : '') }}
              />
              {isStreaming && html && (
                <span className="animate-pulse-soft inline-block ml-0.5">▊</span>
              )}
            </>
          )}
        </div>

        {/* 工具栏：版本切换 + 复制 + 重试（assistant 消息） */}
        {!isUser && !isStreaming && mainContent && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            {versionCount > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <button
                  onClick={() => onSwitchVersion?.(message.id, -1)}
                  disabled={versionIndex === 0}
                  className="p-1 rounded hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="上一个版本"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="tabular-nums select-none">
                  {versionIndex + 1}/{versionCount}
                </span>
                <button
                  onClick={() => onSwitchVersion?.(message.id, +1)}
                  disabled={versionIndex >= versionCount - 1}
                  className="p-1 rounded hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="下一个版本"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 p-1 rounded hover:bg-white/[0.05] hover:text-slate-300 transition-all opacity-0 group-hover:opacity-100"
              title="复制"
            >
              {copied ? (
                <span className="text-emerald-400">已复制</span>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {showRetry && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 p-1 rounded hover:bg-white/[0.05] hover:text-accent-glow transition-all opacity-0 group-hover:opacity-100"
                title="重新生成（保留当前回答）"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center mt-1">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  )
}
