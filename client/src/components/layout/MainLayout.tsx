import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface MainLayoutProps {
  children: React.ReactNode
  disablePadding?: boolean
}

export function MainLayout({ children, disablePadding = false }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64 flex flex-col h-full">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={`flex-1 overflow-auto ${disablePadding ? "" : "p-4 lg:p-6"}`}>{children}</main>
      </div>
    </div>
  )
}

