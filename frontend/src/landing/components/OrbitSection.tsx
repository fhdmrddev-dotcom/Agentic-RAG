import { MODEL_PROVIDERS, LOCAL_RUNTIMES } from "../facts"
import { getModelIcon } from "./BrandIcons"

export function OrbitSection() {
  const allModels = [...MODEL_PROVIDERS, ...LOCAL_RUNTIMES]
  const totalOrbs = allModels.length
  const angleStep = 360 / totalOrbs

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

        <div className="orbit-wrap" style={{ width: "100%", overflow: "hidden" }}>
          <div className="orbit">
            {allModels.map((model, idx) => {
              const rotation = Math.round(idx * angleStep)
              const isLocal = model.id === "ollama" || model.id === "lmstudio"
              const label = isLocal ? `Local · ${model.name}` : model.name

              return (
                <div
                  key={model.id}
                  className="orb"
                  style={{ transform: `rotateY(${rotation}deg) translateZ(300px)` }}
                >
                  {getModelIcon(model.id, { size: 18 })}
                  <span>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
