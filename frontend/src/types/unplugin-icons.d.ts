/**
 * Ambient module declaration for unplugin-icons (~icons/*) bundled imports.
 *
 * unplugin-icons compiles Iconify icon slugs to bundled React SVG components
 * at build time (no runtime fetch). Each ~icons/<set>/<name> import resolves
 * to a React component that renders the icon as an inline SVG.
 *
 * Usage:
 *   import Gear from "~icons/fluent-emoji/gear"
 *   // renders as: <Gear size={18} />
 */
declare module "~icons/*" {
  import type { ComponentType, SVGProps } from "react"
  const component: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>
  export default component
}
