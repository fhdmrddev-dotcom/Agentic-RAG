import "./landing.css"
import "./scenes/scenes.css"
import {
  Navigation,
  HeroSection,
  FeaturesSection,
  TourSection,
  WorkflowSpotlight,
  FilesSection,
  UseCasesSection,
  QuotesSection,
  CompareSection,
  OrbitSection,
  WorksWithSection,
  SecuritySection,
  CtaSection,
  LandingFooter,
} from "./components"

export function LandingPage() {
  return (
    <div className="page-root" style={{ minHeight: "100%", background: "hsl(216 45% 4%)", position: "relative" }}>
      <Navigation />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TourSection />
        <WorkflowSpotlight />
        <FilesSection />
        <UseCasesSection />
        <QuotesSection />
        <CompareSection />
        <OrbitSection />
        <WorksWithSection />
        <SecuritySection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
