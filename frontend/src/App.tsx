import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return <ChatLayout onSignOut={signOut} />
}

export default App
