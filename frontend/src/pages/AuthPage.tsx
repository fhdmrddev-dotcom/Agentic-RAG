import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function AuthPage({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Agentic RAG</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "signin" ? (
            <SignInForm onSubmit={onSignIn} onSwitch={() => setMode("signup")} />
          ) : (
            <SignUpForm onSubmit={onSignUp} onSwitch={() => setMode("signin")} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
