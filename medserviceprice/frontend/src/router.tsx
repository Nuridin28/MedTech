import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { SearchResultsPage } from '@/pages/SearchResultsPage'
import { ServiceDetailPage } from '@/pages/ServiceDetailPage'
import { ClinicProfilePage } from '@/pages/ClinicProfilePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AppointmentsPage } from '@/pages/AppointmentsPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { MedicalRecordsPage } from '@/pages/MedicalRecordsPage'
import { MapPage } from '@/pages/MapPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminAuthProvider } from '@/lib/adminAuth'
import { AdminGate } from '@/components/admin/AdminLayout'
import { AdminOverview } from '@/pages/admin/AdminOverview'
import { AdminSources } from '@/pages/admin/AdminSources'
import { AdminNormalization } from '@/pages/admin/AdminNormalization'
import { AdminAlerts } from '@/pages/admin/AdminAlerts'
import { AdminLogs } from '@/pages/admin/AdminLogs'
import { AdminSettings } from '@/pages/admin/AdminSettings'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchResultsPage /> },
      { path: '/service/:serviceId', element: <ServiceDetailPage /> },
      { path: '/clinic/:clinicId', element: <ClinicProfilePage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/appointments', element: <AppointmentsPage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/records', element: <MedicalRecordsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Admin area: own layout + auth gate, outside the public chrome.
    path: '/admin',
    element: (
      <AdminAuthProvider>
        <AdminGate />
      </AdminAuthProvider>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'sources', element: <AdminSources /> },
      { path: 'normalization', element: <AdminNormalization /> },
      { path: 'alerts', element: <AdminAlerts /> },
      { path: 'logs', element: <AdminLogs /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
])
