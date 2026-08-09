import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from './routes'
import { AuthProvider } from '@/context/AuthContext'
import { ModulosProvider } from '@/context/ModulosContext'
import { HomeSearchProvider } from '@/context/HomeSearchContext'

export default function App() {
  return (
    <AuthProvider>
      <ModulosProvider>
        <HomeSearchProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors />
        </HomeSearchProvider>
      </ModulosProvider>
    </AuthProvider>
  )
}
