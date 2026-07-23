import { useState } from "react"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function AuthPage({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")

  return (
    <AuthCardShell
      title="Agentic RAG"
      subhead={mode === "signin" ? "Sign in to your account" : "Create a new account"}
    >
      {mode === "signin" ? (
        <SignInForm onSubmit={onSignIn} onSwitch={() => setMode("signup")} />
      ) : (
        <SignUpForm onSubmit={onSignUp} onSwitch={() => setMode("signin")} />
      )}
    </AuthCardShell>
  )
}
