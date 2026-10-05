import { io } from 'socket.io-client'

export const socket = import.meta.env.DEV
  ? io('http://localhost:3001')
  : io()
