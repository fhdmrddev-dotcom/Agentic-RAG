/**
 * Phase 183-01 Task 3 — the A1 spike. Answers research assumption A1 / Pitfall 4:
 *
 *   "Does a custom node that renders NO <Handle> still render its edges?"
 *
 * The React Flow docs say a custom node replaces the default node *including its
 * handles*, and point at the Handles page "to enable your custom node to connect
 * with other nodes" — but they never state the "no handle ⇒ no edge" consequence in
 * as many words. That left A1 at MEDIUM confidence, and it decides whether `PhaseNode`
 * (plan 183-06) must render hidden handles or can skip them. Guessing wrong costs
 * either dead code or edges that are invisible until UAT.
 *
 * So: the SAME two-node / one-edge fixture is rendered twice — once through a
 * handle-free custom node, once through one with a target + source <Handle> — and the
 * `.react-flow__edge` elements are counted in each case.
 *
 * This is a PERMANENT committed test, not a throwaway probe: it is the machine-readable
 * record of the answer, and it goes red if a future @xyflow/react upgrade changes the
 * behaviour under us.
 */
import { describe, it, expect } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { ReactFlow, Handle, Position, type Edge, type Node } from "@xyflow/react"
import { mockReactFlow } from "./mockReactFlow"

// Install the four jsdom mocks BEFORE any render — without them React Flow throws
// `ReferenceError: ResizeObserver is not defined` on mount. File-local by design;
// nothing here touches src/setupTests.ts.
mockReactFlow()

/** A custom node with NO <Handle> at all — the shape `PhaseNode` would take if A1 is false. */
function HandlelessNode() {
  return (
    <div style={{ width: "160px", height: "48px" }} data-testid="spike-node">
      handle-free
    </div>
  )
}

/** The same node WITH the two handles Pitfall 4 recommends (hidden in production). */
function HandledNode() {
  return (
    <div style={{ width: "160px", height: "48px" }} data-testid="spike-node">
      <Handle type="target" position={Position.Left} />
      handled
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** Module-level so the identity is stable across renders (React Flow warns otherwise). */
const nodeTypes = { handleless: HandlelessNode, handled: HandledNode }

const nodesOfType = (type: "handleless" | "handled"): Node[] => [
  { id: "a", type, position: { x: 0, y: 0 }, data: {}, style: { width: 160, height: 48 } },
  { id: "b", type, position: { x: 320, y: 0 }, data: {}, style: { width: 160, height: 48 } },
]

const edges: Edge[] = [{ id: "a->b", source: "a", target: "b" }]

/** Render the fixture and return the settled `.react-flow__edge` count. */
async function edgeCountFor(type: "handleless" | "handled"): Promise<number> {
  render(
    // React Flow requires a parent with an explicit width AND height (Pitfall 3).
    <div style={{ width: "800px", height: "400px" }}>
      <ReactFlow nodes={nodesOfType(type)} edges={edges} nodeTypes={nodeTypes} />
    </div>,
  )

  // The mocked ResizeObserver fires on setTimeout(…, 0), so wait for the nodes to be
  // painted before counting edges — a synchronous count races the measurement pass.
  await waitFor(() => {
    expect(document.querySelectorAll(".react-flow__node")).toHaveLength(2)
  })
  await waitFor(() => {
    expect(document.querySelector(".react-flow__edges")).not.toBeNull()
  })

  return document.querySelectorAll(".react-flow__edge").length
}

describe("A1 spike — does a <Handle>-free custom node render edges?", () => {
  it("a handle-free custom node renders NO edge", async () => {
    const count = await edgeCountFor("handleless")
    // A1 VERDICT: a handle-free custom node renders 0 edge(s). Handles are what an
    // edge anchors to, so PhaseNode (183-06) MUST render them — hidden, not omitted.
    expect(count).toBe(0)
  })

  it("the same fixture WITH target+source handles renders the one edge", async () => {
    const count = await edgeCountFor("handled")
    // A1 VERDICT (control): the identical fixture with handles renders 1 edge(s).
    expect(count).toBe(1)
  })
})
