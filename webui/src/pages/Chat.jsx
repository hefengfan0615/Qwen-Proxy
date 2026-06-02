import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../hooks/useChat'
import MessageBubble from '../components/MessageBubble'
import ModelSelector from '../components/ModelSelector'
import { fileToDataURL } from '../utils/imageUtils'

export default function Chat() {
  const {
    conversations,
    activeConversation,
    activeId,
    isStreaming,
    streamingContent,
    streamingReasoning,
    selectedModel,
    changeModel,
    enableThinking,
    enableSearch,
    toggleThinking,
    toggleSearch,
    newChat,
    selectConversation,
    deleteConversation,
    sendMessage,
    stopStreaming,
    retryLastMessage,
    switchMessageVersion,
  } = useChat()

  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [attachments, setAttachments] = useState([])
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [fileError, setFileError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  // 使用 requestAnimationFrame 节流滚动，避免频繁重排
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [])

  useEffect(() => {
    // 流式时滚动到底部，非流式时也滚动
    if (activeConversation?.messages?.length > 0 || isStreaming) {
      scrollToBottom()
    }
  }, [activeConversation?.messages, streamingContent, streamingReasoning, scrollToBottom, isStreaming])

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setIsLoadingFile(true)
    setFileError(null)

    const newAttachments = []

    try {
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          setFileError(`文件 ${file.name} 太大了，最大支持 50MB`)
          continue
        }

        try {
          // 后台异步处理文件，UI 不卡
          const data = await fileToDataURL(file, true)

          newAttachments.push({
            id: Date.now() + Math.random(),
            type: file.type.startsWith('image/') ? 'image' : 'file',
            data,
            name: file.name,
            size: file.size,
            originalSize: file.size,
          })
        } catch (err) {
          console.error('文件处理失败:', err)
          setFileError(`无法处理文件 ${file.name}`)
        }
      }

      if (newAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newAttachments])
      }
    } catch (error) {
      console.error('文件选择失败:', error)
      setFileError('文件处理失败，请重试')
    } finally {
      setIsLoadingFile(false)
      e.target.value = ''
    }
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text && attachments.length === 0) return
    if (isStreaming) return
    if (!activeConversation) return
    setInput('')
    sendMessage(text, attachments)
    setAttachments([])
  }, [input, attachments, isStreaming, activeConversation, sendMessage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const removeAttachment = useCallback((index) => {
    setAttachments(prev => prev.filter((_, j) => j !== index))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversation sidebar */}
      <div
        className={`flex-shrink-0 border-r border-white/[0.06] bg-surface-900/50 transition-all duration-300 flex flex-col min-w-0 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="p-3 border-b border-white/[0.06]">
          <button
            onClick={newChat}
            className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-w-0">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 min-w-0 ${
                conv.id === activeId
                  ? 'bg-white/[0.06] border border-white/[0.08]'
                  : 'hover:bg-white/[0.03]'
              }`}
              onClick={() => selectConversation(conv.id)}
            >
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="flex-1 text-sm text-slate-300 truncate min-w-0">
                {conv.title || '新对话'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              暂无对话
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all flex-shrink-0"
              title="切换侧边栏"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <ModelSelector value={selectedModel} onChange={changeModel} />
            </div>
          </div>
          <div className="text-xs text-slate-500 flex-shrink-0">
            {activeConversation?.messages.length || 0} 条消息
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 min-w-0">
          <div className="max-w-3xl mx-auto space-y-6 min-w-0">
            {!activeConversation ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-accent-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">还没有对话</h2>
                <p className="text-sm text-slate-400 max-w-sm mb-6">
                  点击下面按钮开始一个新会话。
                </p>
                <button
                  onClick={newChat}
                  className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新建对话
                </button>
              </div>
            ) : activeConversation.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-accent-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-display font-semibold text-white mb-2">开始对话</h2>
                <p className="text-sm text-slate-400 max-w-sm">
                  随时提问，由 Qwen AI 模型提供流式响应。
                </p>
              </div>
            ) : (
              <>
                {activeConversation.messages.map((msg, idx) => {
                  const isLastAssistant =
                    msg.role === 'assistant' &&
                    idx === activeConversation.messages.length - 1
                  return (
                    <MessageBubble
                      key={msg.id || idx}
                      message={msg}
                      onRetry={retryLastMessage}
                      onSwitchVersion={switchMessageVersion}
                      showRetry={isLastAssistant && !isStreaming}
                    />
                  )
                })}
                {isStreaming && (streamingContent || streamingReasoning) && (
                  <MessageBubble
                    message={{
                      role: 'assistant',
                      content: streamingContent,
                      reasoning_content: streamingReasoning,
                      id: 'streaming'
                    }}
                    isStreaming
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area: only when there is an active conversation */}
        {activeConversation && (
        <div className="border-t border-white/[0.06] bg-surface-900/50 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto min-w-0">
            {/* Toggles: thinking / search */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={toggleThinking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  enableThinking
                    ? 'bg-accent-primary/15 border-accent-primary/30 text-accent-glow'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
                }`}
                title="思考模式：让模型先输出推理过程"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                思考
              </button>
              <button
                type="button"
                onClick={toggleSearch}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  enableSearch
                    ? 'bg-accent-primary/15 border-accent-primary/30 text-accent-glow'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-200'
                }`}
                title="联网搜索：在回答前检索网络信息"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                搜索
              </button>
            </div>

            {/* Error message */}
            {fileError && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center justify-between">
                <span className="truncate flex-1 min-w-0">{fileError}</span>
                <button
                  onClick={() => setFileError(null)}
                  className="ml-2 text-red-400 hover:text-red-300 flex-shrink-0"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap max-w-full">
                {attachments.map((att, i) => (
                  <div key={att.id || i} className="relative group flex-shrink-0">
                    {att.type === 'image' ? (
                      <div className="relative">
                        <img
                          src={att.data}
                          className="h-16 w-16 rounded-lg object-cover border border-white/10"
                          loading="lazy"
                          decoding="async"
                          alt={att.name}
                        />
                        {att.originalSize && att.originalSize > 5 * 1024 * 1024 && (
                          <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/60 text-white px-1 rounded">
                            压缩
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-16 px-3 rounded-lg bg-white/[0.06] border border-white/10 flex items-center gap-2 max-w-[150px]">
                        <span className="text-xs text-slate-400 truncate min-w-0">{att.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3 min-w-0">
              {/* File upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingFile}
                className="flex-shrink-0 p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] border border-white/[0.08] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="上传文件"
              >
                {isLoadingFile ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex-1 relative min-w-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  rows={1}
                  className="input-field resize-none min-h-[48px] max-h-[200px] pr-12 w-full"
                  style={{ height: Math.min(200, Math.max(48, input.split('\n').length * 24 + 24)) + 'px' }}
                />
              </div>
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex-shrink-0 p-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-lg hover:shadow-accent-primary/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600 text-center">
              按 Enter 发送，Shift+Enter 换行
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
