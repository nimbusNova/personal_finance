import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <main className="min-h-screen bg-gray-900">
      {!isLoggedIn ? (
        <LoginScreen onLogin={() => setIsLoggedIn(true)} />
      ) : (
        <Dashboard />
      )}
    </main>
  )
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Call API
    onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Personal Finance
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-bold text-white">
                Portfolio Intelligence
              </Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/" className="text-gray-300 hover:text-white px-3 py-2">
                  Dashboard
                </Link>
                <Link href="/upload" className="text-gray-300 hover:text-white px-3 py-2">
                  Upload
                </Link>
                <Link href="/holdings" className="text-gray-300 hover:text-white px-3 py-2">
                  Holdings
                </Link>
                <Link href="/transactions" className="text-gray-300 hover:text-white px-3 py-2">
                  Spending
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total Net Worth" value="$0.00" change="+0.00%" />
          <StatCard title="Invested" value="$0.00" change="+0.00%" />
          <StatCard title="Cash" value="$0.00" change="$0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h2>
            <p className="text-gray-400">Upload your first statement to see your allocation.</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
            <p className="text-gray-400">No statements uploaded yet.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, change }: { title: string; value: string; change: string }) {
  const isPositive = change.startsWith('+')
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-sm ${isPositive ? 'text-green-400' : 'text-gray-400'}`}>
        {change}
      </p>
    </div>
  )
}