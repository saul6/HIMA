import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface HomeSearchCtx {
  busqueda: string
  setBusqueda: (q: string) => void
}

const HomeSearchContext = createContext<HomeSearchCtx>({
  busqueda: '',
  setBusqueda: () => {},
})

export function HomeSearchProvider({ children }: { children: ReactNode }) {
  const [busqueda, setBusqueda] = useState('')
  return (
    <HomeSearchContext.Provider value={{ busqueda, setBusqueda }}>
      {children}
    </HomeSearchContext.Provider>
  )
}

export function useHomeSearch() {
  return useContext(HomeSearchContext)
}
