import React, { createContext, useContext, useState, useEffect } from 'react'
import { getUsers } from '../api'

const UserContext = createContext([])

export function UserProvider({ children }) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    getUsers()
      .then(res => setUsers(res.data?.data || []))
      .catch(() => {})
  }, [])

  return <UserContext.Provider value={users}>{children}</UserContext.Provider>
}

export const useUsers = () => useContext(UserContext)
