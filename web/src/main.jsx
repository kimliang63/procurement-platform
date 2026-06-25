import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// HRAS SDK 接入：等待壳子上下文就绪后渲染
async function bootstrap() {
  // 如果 SDK 已加载，等待就绪
  if (window.__HRAS__) {
    try {
      await window.__HRAS__.ready()
      const user = window.__HRAS__.getUser()
      console.log('[HRAS] 用户信息:', user)
    } catch (e) {
      console.warn('[HRAS] SDK ready 失败，独立运行:', e.message)
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
