import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { Sparkles } from "lucide-react"

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
}

export function AuthPage({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md ghost-border bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold">Agentic RAG</CardTitle>
            <CardDescription className="mt-1.5">
              {mode === "signin" ? "Sign in to your account" : "Create a new account"}
            </CardDescription>
          </div>
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
