import {
  AnthropicIcon,
  OpenAIIcon,
  GoogleIcon,
  DeepSeekIcon,
  ZhipuIcon,
  MinimaxIcon,
  MoonshotIcon,
  OpenRouterIcon,
  LmStudioIcon,
} from "./BrandIcons"

export function OrbitSection() {
  return (
    <section id="models" style={{ padding: "0 0 96px", position: "relative", zIndex: 1 }}>
      <div
        className="wrap"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div className="eyebrow">Models</div>
        <h2
          className="hl h2"
          style={{
            margin: 0,
            fontSize: 36,
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Bring your own model. Switch any time.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.6,
            color: "hsl(220 16% 65%)",
            maxWidth: 560,
          }}
        >
          Your keys, your bill. Pick a provider per conversation or per workflow step; run a local
          model when data must not leave the network.
        </p>

        <div className="orbit-wrap" style={{ width: "100%" }}>
          <div className="orbit">
            <div className="orb" style={{ transform: "rotateY(0deg) translateZ(300px)" }}>
              <AnthropicIcon size={18} />
              <span>Anthropic</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(40deg) translateZ(300px)" }}>
              <OpenAIIcon size={18} />
              <span>OpenAI</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(80deg) translateZ(300px)" }}>
              <GoogleIcon size={18} />
              <span>Google</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(120deg) translateZ(300px)" }}>
              <DeepSeekIcon size={18} />
              <span>DeepSeek</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(160deg) translateZ(300px)" }}>
              <ZhipuIcon size={18} />
              <span>Zhipu GLM</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(200deg) translateZ(300px)" }}>
              <MinimaxIcon size={18} />
              <span>MiniMax</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(240deg) translateZ(300px)" }}>
              <MoonshotIcon size={18} />
              <span>Moonshot</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(280deg) translateZ(300px)" }}>
              <OpenRouterIcon size={18} />
              <span>OpenRouter</span>
            </div>
            <div className="orb" style={{ transform: "rotateY(320deg) translateZ(300px)" }}>
              <LmStudioIcon size={18} />
              <span>Local · LM Studio</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
