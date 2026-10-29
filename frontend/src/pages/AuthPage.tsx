import { useState } from "react"
import { AuthCardShell } from "@/components/auth/AuthCardShell"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { RETURN_LINE, kindWord } from "@/lib/returnTo"

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function AuthPage({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  // Phase 299-05 (D-22 / S5): one quiet line under the form when the address opens a THING —
  // the kind only, from the path, never its title (a signed-out visitor may not learn it).
  const kind = kindWord(window.location.pathname, window.location.search)
  const line = kind ? RETURN_LINE[mode](kind) : null

  return (
    <AuthCardShell
      title="Syrel"
      subhead={mode === "signin" ? "Sign in to your account" : "Create a new account"}
    >
      {mode === "signin" ? (
        <SignInForm onSubmit={onSignIn} onSwitch={() => setMode("signup")} />
      ) : (
        <SignUpForm onSubmit={onSignUp} onSwitch={() => setMode("signin")} />
      )}
      {line && <p className="mt-4 text-center text-xs text-muted-foreground">{line}</p>}
    </AuthCardShell>
  )
}
