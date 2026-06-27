import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'
import { api, ApiError } from '@/api/client'
import type { ChatTurn } from '@/api/types'
import { useI18n } from '@/lib/i18n'

/** How many prior turns we send back as context (server caps this again). */
const HISTORY_TURNS = 6

/**
 * Floating AI assistant. Answers ONLY questions about MedServicePrice.kz — the
 * domain scoping, prompt/response validation and rate limiting all live server-side
 * in app/services/assistant.py; this widget is a thin chat UI over /api/assistant/chat.
 * It hides itself entirely when the backend reports the assistant is off.
 */
export function AssistantChat() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Only show the widget when the assistant is actually configured.
  useEffect(() => {
    let alive = true
    api
      .assistantStatus()
      .then((s) => alive && setEnabled(s.enabled))
      .catch(() => alive && setEnabled(false))
    return () => {
      alive = false
    }
  }, [])

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await api.assistantChat(text, next.slice(-HISTORY_TURNS))
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 429
          ? t('Слишком много запросов. Подождите немного и попробуйте снова.')
          : t('Не удалось получить ответ. Попробуйте позже.')
      setMessages((m) => [...m, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t('Закрыть чат') : t('Открыть чат-ассистент')}
        className="fixed bottom-5 right-5 z-[1000] w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-container transition-colors active:scale-95"
      >
        <Icon name={open ? 'close' : 'chat'} className="text-[26px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={t('Чат-ассистент')}
            className="fixed bottom-24 right-5 z-[1000] w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] flex flex-col rounded-2xl overflow-hidden bg-surface-container-lowest dark:bg-dark-surface-container border border-outline-variant shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-primary text-on-primary shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                <Icon name="smart_toy" className="text-[20px]" />
              </div>
              <div className="min-w-0">
                <p className="font-label-bold text-label-bold leading-tight">{t('Ассистент')}</p>
                <p className="text-xs opacity-80 truncate">{t('Помогу разобраться с сервисом')}</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-text-subtle font-body-sm py-6">
                  <Icon name="forum" className="text-[32px] text-outline-variant mb-2 block mx-auto" />
                  <p className="mb-1 text-on-surface font-label-bold">{t('Чем помочь?')}</p>
                  <p>
                    {t('Спросите про поиск и сравнение цен, карту клиник или подписку на снижение цены.')}
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-on-primary px-3.5 py-2 font-body-sm whitespace-pre-wrap'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-container-high dark:bg-dark-surface text-on-surface px-3.5 py-2 font-body-sm whitespace-pre-wrap'
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-surface-container-high dark:bg-dark-surface text-text-subtle px-3.5 py-2 font-body-sm flex items-center gap-2">
                    <Icon name="progress_activity" className="animate-spin text-[18px]" />
                    {t('Печатает…')}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-outline-variant p-2.5">
              <div className="flex items-end gap-2">
                <label htmlFor="assistant-input" className="sr-only">
                  {t('Ваш вопрос')}
                </label>
                <input
                  id="assistant-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  maxLength={1000}
                  placeholder={t('Спросите о сервисе…')}
                  className="flex-1 bg-surface-container dark:bg-dark-surface border border-outline-variant rounded-xl px-3.5 py-2.5 font-body-sm text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  aria-label={t('Отправить')}
                  className="w-10 h-10 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="send" className="text-[20px]" />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] text-text-subtle">
                {t('Отвечает только на вопросы о MedServicePrice.kz')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
