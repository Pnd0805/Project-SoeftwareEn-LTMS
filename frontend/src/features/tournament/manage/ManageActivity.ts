import { createContext, useContext } from 'react'

/* แผงที่ซ่อนไว้ยังเก็บ draft อยู่ แต่ dialog อยู่ใน portal จึงต้องปิดการแสดงผลแยกกัน */
export const ManageActivity = createContext(true)
export const useManageActive = () => useContext(ManageActivity)
