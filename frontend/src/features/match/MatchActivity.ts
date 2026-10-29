import { createContext, useContext } from 'react'

export const MatchActivity = createContext(true)
export const useMatchActive = () => useContext(MatchActivity)
