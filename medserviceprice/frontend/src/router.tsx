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
import { AdminPage } from '@/pages/AdminPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchResultsPage /> },
      { path: '/service/:serviceId', element: <ServiceDetailPage /> },
      { path: '/clinic/:clinicId', element: <ClinicProfilePage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/appointments', element: <AppointmentsPage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/records', element: <MedicalRecordsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
