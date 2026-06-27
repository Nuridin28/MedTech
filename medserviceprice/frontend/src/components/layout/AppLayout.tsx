import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { TopNav } from './TopNav'
import { Footer } from './Footer'
import { AssistantChat } from '@/components/AssistantChat'

/**
 * App shell: sticky nav + animated route outlet + footer.
 * Page transitions use framer-motion's AnimatePresence keyed on pathname so each
 * route fades/slides in smoothly. Reduced-motion users get an instant swap
 * (handled by the CSS media query in index.css).
 */
export function AppLayout() {
  const location = useLocation()

  // Scroll to top on every route change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-dark-surface">
      <TopNav />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <AssistantChat />
    </div>
  )
}
