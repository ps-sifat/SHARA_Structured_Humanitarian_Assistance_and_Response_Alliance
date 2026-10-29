import { RouterProvider } from 'react-router'
import { router } from './app/routes'
import { AuthProvider } from './app/auth'

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
