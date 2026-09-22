/**
 * ⛔ THE ACTIVEVIEW REACHABILITY CHECKER — Phase 262 / PACK-11 / D-262-04.
 *
 * This app has NO ROUTER. A top-level home is three things that have to agree:
 *   1. a member of `ActiveView` in `App.tsx`
 *   2. a render branch in `ChatLayout.tsx`
 *   3. something that navigates to it
 * — the "reachability triad". Leg 2 was carried by PROSE in three comment blocks and by
 * nothing executable: `262-RESEARCH.md` R-2 measured that a branchless 13th member ships
 * GREEN today, because ChatLayout's trailing `<UnknownViewFallback view={activeView as never} />`
 * is a POSITIONAL fallback rather than a `default:` that throws, and a ternary chain does not
 * narrow to `never`. This module is leg 2's executable half.
 *
 * ⛔ IT PARSES, IT DOES NOT GREP. A `grep`-shaped check over `App.tsx` counts the member name
 * wherever prose repeats it — which is why `App.tsx:96` deliberately refuses to spell its own
 * twelfth member in a comment (the 187-24 lesson). `ts.createSourceFile` sees declarations, so
 * a comment cannot satisfy this measurement and a comment cannot break it either.
 *
 * ⛔ IT REFUSES TO BE VACUOUS. A checker that silently parses zero members passes everything.
 * Every "nothing found" path THROWS `ActiveViewReachabilityError`. A report over nothing is
 * worse than no report.
 *
 * `typescript` is already a `frontend/package.json` devDependency (`~5.9.3`), so this adds no
 * package. Nothing in the app bundle imports this file — its only consumer is its own suite.
 */

import * as tsNamespace from "typescript"

type TsModule = typeof import("typescript")

/** `typescript` ships CJS. Under `verbatimModuleSyntax` the namespace import typechecks, and
 *  the `.default` unwrap covers the Node CJS→ESM interop shape at runtime. Measured both ways. */
const ts: TsModule = ((tsNamespace as unknown as { default?: TsModule }).default ?? tsNamespace) as TsModule

export interface ReachabilityReport {
  /** Every string literal member of the `ActiveView` union, in declaration order. */
  members: string[]
  /** Every distinct `activeView === "…"` comparison literal in the layout, in source order. */
  branched: string[]
  /** Members with no matching comparison — the defect. Order follows `members`. */
  unbranched: string[]
  /**
   * True only when an `UnknownViewFallback` element EXISTS and sits after every
   * `activeView === "…"` comparison. A missing fallback is `false`, never true-by-absence.
   */
  fallbackIsLast: boolean
}

export class ActiveViewReachabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActiveViewReachabilityError"
  }
}

const FALLBACK_TAG = "UnknownViewFallback"
const VIEW_IDENTIFIER = "activeView"

function parse(fileName: string, source: string): tsNamespace.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, /* setParentNodes */ false, ts.ScriptKind.TSX)
}

function walk(node: tsNamespace.Node, visit: (n: tsNamespace.Node) => void): void {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

/** The `ActiveView` union's string-literal members, from the AST. */
function readMembers(appSource: string): string[] {
  const sourceFile = parse("App.tsx", appSource)
  let alias: tsNamespace.TypeAliasDeclaration | undefined

  walk(sourceFile, (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "ActiveView") alias = node
  })

  if (!alias) {
    throw new ActiveViewReachabilityError(
      "no `ActiveView` type alias found in the app source — refusing to report over nothing",
    )
  }

  const members: string[] = []
  const aliasType = (alias as tsNamespace.TypeAliasDeclaration).type
  const branches = ts.isUnionTypeNode(aliasType) ? aliasType.types : [aliasType]
  for (const t of branches) {
    if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) members.push(t.literal.text)
  }

  if (members.length === 0) {
    throw new ActiveViewReachabilityError(
      "the `ActiveView` alias parsed to zero string-literal members — refusing to report over nothing",
    )
  }
  return members
}

interface LayoutFacts {
  branched: string[]
  lastComparisonPos: number
  fallbackPos: number | null
}

/** Every `activeView === "…"` comparison and the position of the `UnknownViewFallback` element. */
function readLayout(layoutSource: string): LayoutFacts {
  const sourceFile = parse("ChatLayout.tsx", layoutSource)
  const branched: string[] = []
  let lastComparisonPos = -1
  let fallbackPos: number | null = null

  walk(sourceFile, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === VIEW_IDENTIFIER &&
      ts.isStringLiteral(node.right)
    ) {
      // A sub-expression, so `activeView === "workflow-run" && canvasEnabled` is caught too.
      if (!branched.includes(node.right.text)) branched.push(node.right.text)
      if (node.pos > lastComparisonPos) lastComparisonPos = node.pos
      return
    }

    const tagName = ts.isJsxSelfClosingElement(node)
      ? node.tagName
      : ts.isJsxOpeningElement(node)
        ? node.tagName
        : undefined
    if (tagName && ts.isIdentifier(tagName) && tagName.text === FALLBACK_TAG) {
      if (fallbackPos === null || node.pos > fallbackPos) fallbackPos = node.pos
    }
  })

  if (branched.length === 0) {
    throw new ActiveViewReachabilityError(
      'no `activeView === "…"` comparison found in the layout source — refusing to report over nothing',
    )
  }
  return { branched, lastComparisonPos, fallbackPos }
}

/**
 * Measure whether every `ActiveView` member has a `ChatLayout` render branch, and whether the
 * positional fallback still sits last.
 *
 * @throws {ActiveViewReachabilityError} when either side parses to nothing.
 */
export function activeViewReachability(appSource: string, layoutSource: string): ReachabilityReport {
  const members = readMembers(appSource)
  const { branched, lastComparisonPos, fallbackPos } = readLayout(layoutSource)

  return {
    members,
    branched,
    unbranched: members.filter((m) => !branched.includes(m)),
    fallbackIsLast: fallbackPos !== null && fallbackPos > lastComparisonPos,
  }
}
