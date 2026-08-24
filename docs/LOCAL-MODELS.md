# Running Local LLMs

A practical guide to running this platform against local model infrastructure —
from a single workstation GPU to a multi-node cluster. Sizing the deployment,
choosing a serving stack, registering models correctly, authoring skills that
survive them, and knowing when fine-tuning is the answer.

> **Provenance.** Figures marked **[measured]** were recorded on the reference
> tier-1 machine in the appendix. Everything else is general engineering
> guidance — sound practice, but **not measured by us**. Benchmark your own
> tier-2/3 hardware before committing capacity plans to it.

---

## 1. What "local" means here, and what it costs

The platform routes every model through the same agent loop, the same tool
contract, and the same context management. A local model is not a second-class
path — it is the *same* path with a different endpoint. That is the design goal:
**a local model should behave exactly like a hosted one.**

| | Hosted API | Local |
|---|---|---|
| Data leaves your network | yes | **no** |
| Marginal cost per run | per-token | **electricity / amortised hardware** |
| Generation speed | 50–200 tok/s | **7–40 tok/s** tier 1 · **30–80 tok/s** tier 2–3 |
| Tool-calling reliability | high | **verify per model** (tier 1) · generally solid (tier 2–3) |
| Setup | an API key | sizing, serving stack, load tuning, registry config |

**[measured]** The same agentic task — six knowledge-base searches, a skill load,
a rendered Word document — on identical infrastructure: **hosted mid-tier model,
69 seconds; 20B local model on a 6 GB laptop GPU, 26 minutes.** Both produced a
correct document. That 22× gap is a *tier-1* number and shrinks dramatically with
better hardware.

---

## 2. Deployment tiers — size the deployment before anything else

"Local" spans three orders of magnitude of hardware, and the correct
configuration differs by more than scale. **Some guidance in this document
inverts between tiers.**

| | **Tier 1 — Workstation** | **Tier 2 — Single node** | **Tier 3 — Cluster** |
|---|---|---|---|
| Hardware | 1 consumer GPU, 8–24 GB | 1–8 datacentre GPUs, 48–640 GB | multi-node, tensor + pipeline parallel |
| Models | 7B–30B, MoE preferred, 4-bit | 30B–120B; 70B at BF16 across cards | 200B–700B+, frontier-class open weights |
| Serving | LM Studio, Ollama, llama.cpp | vLLM, SGLang, TGI | vLLM / SGLang with a scheduler |
| Concurrency | 1 request | continuous batching, dozens of streams | high, with prioritisation |
| Generation | 7–40 tok/s | 30–80 tok/s per stream | comparable to hosted |
| Fits | one operator; dev; privacy-critical desk work | a team or department | org-wide; replaces hosted |

### What inverts between tiers

Applying tier-1 advice to a server actively harms it.

| Concern | Tier 1 — workstation | Tier 2–3 — server |
|---|---|---|
| Concurrent requests | **1** — anything more thrashes | **Opposite:** throughput *comes from* batching. Set it high. |
| Batch size | Tune by hand; a cliff exists | The engine schedules it. Tune `--max-num-seqs`, `--gpu-memory-utilization`. |
| Quantization | 4-bit essentially mandatory | Often unnecessary. FP8 for throughput; BF16 when it fits. |
| CPU offload / expert placement | A real lever | **Never offload.** If it does not fit, add cards or shard. |
| KV cache | The binding constraint | Paged attention manages it; size via `--max-model-len`. |
| Call timeout | `900` s — runs take minutes | `120–300` s — a slow call means a real problem. |
| Tool-calling reliability | Must be verified per model | Generally solid on 70B+ open weights. |
| Bounded-output skills | **Survival requirement** | Good hygiene; not survival. |
| Context window | 32k floor, often the ceiling too | 128k+ routine; cost is KV memory per stream. |

---

## 3. Choosing a serving stack

The platform requires only an OpenAI-compatible chat-completions endpoint, so the
stack is your choice — but it sets your throughput ceiling.

| Stack | Tier | Strengths | Watch for |
|---|---|---|---|
| **LM Studio** | 1 | GUI load tuning, fast iteration | Desktop app; single-user; not a server |
| **Ollama** | 1 | Simple, scriptable, sane defaults | Less control over load placement |
| **llama.cpp server** | 1–2 | Runs anywhere, CPU+GPU hybrid, GGUF | Lower throughput than vLLM at scale |
| **vLLM** | 2–3 | Paged attention, continuous batching, tensor parallel | Wants datacentre GPUs; GGUF not its strength |
| **SGLang** | 2–3 | Strong structured-output and prefix-cache performance | Younger ecosystem |
| **TGI** | 2–3 | Mature, good operational tooling | Fewer bleeding-edge optimisations |

> **A useful pattern:** use a tier-1 stack to *choose* the model — verify tool
> calling, check output quality, confirm the registry contract — then deploy that
> same model on a tier-2 stack. The registry row carries over unchanged.

### Serving concepts that matter at tier 2–3

- **Continuous batching.** Many requests interleave through the model
  simultaneously; aggregate throughput can be an order of magnitude above
  single-stream. Per-request latency is the wrong metric on a server.
- **Paged attention.** KV cache allocated in pages rather than contiguous blocks,
  so memory is not wasted on padding. It is what makes high concurrency affordable.
- **Tensor parallelism** (`--tensor-parallel-size`) splits each layer across GPUs;
  use it to fit a model exceeding one card. **Pipeline parallelism** splits layers
  across nodes — only once tensor parallel is exhausted.
- **Prefix caching.** At tier 2–3 this is usually a real radix/prefix cache rather
  than the exact-match caching common at tier 1, so system prompt and tool schemas
  genuinely cache across requests. That shifts §8's arithmetic in your favour.

### Sizing a server deployment

```
weights       = params × bytes-per-param     (BF16 = 2, FP8 = 1, 4-bit ≈ 0.5)
KV per token  = 2 × layers × kv_heads × head_dim × bytes
concurrent KV = KV per token × max-model-len × max-num-seqs
total         = weights + concurrent KV + activation overhead
```

A 70B at BF16 is ~140 GB of weights before any cache — two 80 GB cards with
tensor parallelism, or four at FP8 with room for real concurrency.
**Concurrency, not the model, usually consumes the remaining memory.**

---

## 4. Sizing a single GPU — the VRAM envelope

> **Applies to tier 1 primarily**, and per-card at tier 2. On a server you never
> trade VRAM against a desktop compositor, and you never offload to CPU.

```
usable VRAM    = total VRAM − desktop/compositor overhead
weights budget = usable VRAM − KV cache − compute buffer
```

**[measured]** Desktop overhead is not negligible: on a 6 GB card with a browser,
an IDE and tray applications, ~**1.3 GB** was consumed before any model loaded —
the window compositor alone ~590 MB.

```bash
nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv
```

Per-process on Windows, `nvidia-smi` cannot help (the OS does that accounting).
Use **Task Manager → Details → Dedicated GPU memory** column.

**KV cache** at 32k with Q4 quantization: ~**1–1.5 GB**. **Compute buffers**:
another **0.5–1 GB**.

### The single most important indicator

Watch **Shared GPU memory**, not Dedicated. Dedicated filling up is fine. *Shared*
climbing means VRAM has spilled into system RAM over PCIe — far worse than
deliberately keeping layers on CPU.

**[measured]** A config spilling ~1.9 GB ran prefill at **310 tok/s**; the same
model class without spill ran **1,000+ tok/s**. A 3× penalty, invisible unless you
watch the right number.

> **Rule:** if Shared rises above idle baseline, reduce GPU offload until it
> returns. Fewer layers on GPU with no spill beats more layers with spill.

---

## 5. Choosing a model

### Dense vs Mixture-of-Experts

For constrained VRAM, **MoE punches far above its parameter count** — only a
fraction of weights activate per token, so CPU offload costs far less than for a
dense model where every parameter is touched every token.

**[measured]** on the same 6 GB card:

| model | size on disk | generation |
|---|---|---|
| 20B **MoE** (~3.6B active), MXFP4 | 12.1 GB | **11.6 tok/s** |
| 9B **dense**, Q4 GGUF | 7.8 GB | 10.0 tok/s |

The 20B MoE beat the 9B dense despite being 55% larger. **Do not assume smaller
is faster.**

### Quantization

| format | tier | notes |
|---|---|---|
| **BF16 / FP16** | 2–3 | No quality question. Weights = 2 bytes/param. |
| **FP8** | 2–3 | Near-free quality cost on recent datacentre cards; big KV headroom. |
| **AWQ / GPTQ** | 2–3 | 4-bit for GPU serving; better than GGUF on vLLM-class stacks. |
| **MXFP4** | 1 | Native 4-bit; very compact, no conversion loss. |
| **UD-Q4_K_XL** | 1 | Dynamic per-layer bits; best quality-per-byte among 4-bit GGUFs. |
| **Q4_K_M** | 1 | Solid, widely available baseline. |
| **IQ4_XS / IQ3** | 1 | Measurable quality loss. Fine for extraction/classification. |
| **IQ2 and below** | — | Avoid for anything generating code. Syntax errors appear. |

⚠ **Verify the file, not the write-up.** A model documented as "~5.1 GB at
Q4_K_M" measured **7.50 GB** in its real download listing; the Q4_K_XL build was
**7.79 GB**. That 2.7 GB error is the difference between fitting and not fitting.

### Multi-Token Prediction (tier 1)

Some builds ship speculative decoding baked in — **1.4×–2.2× faster generation**
at no quality cost. Since generation is the tier-1 bottleneck, prefer an MTP build
when one exists. Set draft tokens to **2**; acceptance collapses from ~83% at 2 to
~50% at 4.

### Non-negotiable requirements

1. **Native tool-calling support** (OpenAI-compatible `tools` parameter).
2. **At least a 32k context window** — see §7.

---

## 6. Connecting the provider

Point the provider's base URL at your server and confirm the model appears in the
composer's model picker.

⚠ **The model id must match exactly** what the server reports:

```bash
curl http://<host>:<port>/v1/models
```

A mismatch either 404s or — worse — causes a **just-in-time load of a second copy**
at a small default context, competing for VRAM with the copy you tuned.

---

## 7. The Model Registry — the step that is not optional

**Universal across all tiers.** This is the most important section of this guide.

A model with **no registry row** falls back to inferred defaults, and for local
providers those are deliberately conservative: `native_tools = false`.

That routes the model into **structured mode**, in which the `tools` parameter is
**never sent**. The model then *describes* the tool call it wants, as prose:

```
<tool_call>
<function=search_documents>
<parameter=query>...
```

The parser cannot read it, no tool calls are returned, and the loop terminates
after one iteration. **There is no error.** The run just ends early.

### Register every local model

| field | value | why |
|---|---|---|
| `native_tools` | `true` | Without it, tool calling silently does not happen |
| `context_window_tokens` | **the LOADED context, not the advertised maximum** | Drives the trimmer; wrong values cause hard 400s |
| `max_output_tokens` | realistic ceiling (e.g. `4096`) | Reserved out of the budget |
| `llm_call_timeout_seconds` | tier 1: `900` · tier 2–3: `120–300` | Local calls take minutes at tier 1 |

⚠ A model may advertise 262,144 while loaded at 32,768. Enter **32768**. The
advertised figure makes the trimmer believe it has eight times the room, so it
never trims and runs die with:

```
400: request (41206 tokens) exceeds the available context size (32768)
```

### How the context budget is derived

```
budget = context_window_tokens
       − max_output_tokens     (the model's own reply)
       − tool schema cost      (measured, ~5–7k for the default toolbox)
       − 10% of the window     (system prompt, skill catalog, slack)
```

At 32,768: `32768 − 4096 − 7028 − 3277 ≈ **18,368 tokens**` of history.

**This is why 32k is the practical floor.** At 16,384 the same arithmetic leaves
only **~3,600 tokens** — tool schemas alone consume a third of the window.

> The budget only ever clamps *downward* toward a model's true limit. Setting the
> field can never grant a model more context than it has.

---

## 8. Tuning & throughput

### Tier 1 — load settings on a workstation **[measured]**

Measured on a 6 GB laptop GPU. **None of this applies to a tier-2/3 server**,
where the engine schedules batching for you.

| physical batch | prefill | vs baseline |
|---|---|---|
| 512 | 183 tok/s | −32% |
| 1024 | 269 tok/s | baseline |
| 2048 | 348 tok/s | +29% |
| **4096** | **423 tok/s** | **+57%** |
| 8192 | 139 tok/s | **−48% — cliff** |

A clean single peak. The tell for the cliff is that **prefill goes flat across all
prompt sizes** — it has stopped being compute-bound. Find your peak by doubling
until throughput drops, then step back one.

⚠ On a model already at the VRAM edge, an over-large batch does not degrade
gracefully — **it can terminate the inference engine outright.**

**Expert placement does almost nothing.** Moving MoE expert layers CPU↔GPU
measured **0% prefill difference**, twice. Placement is a *space* lever, not a
*speed* lever — useful only to free room for a bigger batch.

| setting | value |
|---|---|
| Context length | **32768** minimum |
| Flash Attention | **on** (required for KV quantization) |
| K/V cache quantization | `Q8_0`, or `Q4_0` if tight |
| Max concurrent predictions | **1** |
| Speculative decoding | MTP draft, **2** tokens |
| "Remember settings" | **on** |

**Prompt caching.** Many tier-1 servers do **exact-match** caching, not prefix
reuse. **[measured]** An identical repeat returned in 0.31 s (129× faster), but
changing only the **final six tokens** discarded the whole 8,429-token cache.
Since an agent loop appends a message every turn, "put stable content first" buys
nothing there. **At tier 2–3 this reverses** — a real prefix cache does reuse the
stable head.

### Tier 2–3 — throughput on a server

You are not tuning a single stream; you are choosing a point on the
latency/throughput curve.

| knob | effect | guidance |
|---|---|---|
| `--gpu-memory-utilization` | VRAM fraction for weights + KV | 0.85–0.95; leave fragmentation headroom |
| `--max-model-len` | longest accepted context | Set to real need — every token multiplies across streams |
| `--max-num-seqs` | concurrent sequences in a batch | The main throughput lever; raise until latency breaches SLO |
| `--tensor-parallel-size` | GPUs per layer split | Smallest value that fits; more adds communication overhead |
| Quantization | FP8 / AWQ / GPTQ | FP8 buys substantial KV headroom at little quality cost |

⚠ **Measure aggregate, not single-stream.** A server tuned for throughput shows
*worse* single-request latency than the same hardware serving one stream, and is
several times more productive.

**Platform-side concurrency.** The application is multi-worker by default
(`WORKER_COUNT=2`) and applies a per-run semaphore to sub-agent tasks. When you
raise server concurrency, raise worker count with it — otherwise the bottleneck
moves from the model to the application.

---

## 9. Diagnostics

| Symptom | Cause | Fix |
|---|---|---|
| Run ends after one tool call; text contains `<tool_call>` markup | `native_tools=false` | Registry row (§7) |
| `400: request (N tokens) exceeds the available context size` | `context_window_tokens` absent or set to advertised max | Use the **loaded** context |
| Dies mid-response with a length error | Budget larger than real window; trimmer never trimmed | As above |
| `PackageNotFoundError` on `/sandbox/<file>` | `execute_code` omitted `skill_files` | §10 |
| Generated file never reaches the user | Omitted `output_files`, or wrote outside `/sandbox/output/` | §10 |
| Times out while still emitting code | Unbounded generation | §10 |
| Engine dies; later calls fail to connect | Batch/context too large for VRAM | Lower batch, reload |
| 3× slower than a comparable config | VRAM spilling to shared memory | Reduce GPU offload |
| Server throughput far below expectation | `--max-num-seqs` too low, or prefix caching not engaging | §8 |
| UI shows a run "executing" the DB says finished | Stale client-side stream cache | Close **all** tabs, clear the cache key, reopen — a refresh alone re-persists the stale state first |

**Check the database, not the UI, to determine whether a run is alive.** The run
record is the source of truth.

---

## 10. Authoring skills that work on local models

> **Tier note.** These rules are **survival requirements at tier 1** and **good
> hygiene at tier 2–3**. A 70B+ model on a server will usually infer optional tool
> arguments and bound its own output. Authoring to these rules anyway keeps skills
> portable — which matters the day someone runs your skill on a laptop.

### Bound the output

**[measured]** A skill instructing the model to rebuild a report programmatically
worked on a frontier model. On a local model at ~12 tok/s it was still emitting
code at **6.3 KB** when killed — twice, at two different limits. Given more time
it wrote *more* code, never converging.

Rewritten to **fill a template** — a fixed dictionary of 52 values rendered into a
`.docx` — the same task became a **37-line block** that completed reliably.

Prefer shapes where the model *cannot* ramble: fill a template; complete a fixed
dictionary; emit schema-conforming JSON.

### State tool arguments explicitly

| argument | required when | if omitted |
|---|---|---|
| `code` | always | — |
| `libraries` | importing non-stdlib | slow install or `ImportError` |
| **`skill_files`** | code opens a file attached to the skill | file never copied into the sandbox |
| **`output_files`** | skill produces a file for the user | file generated, then discarded |

Path contract:

- Attached files arrive at `/sandbox/<filename>`.
- Deliverables go to `/sandbox/output/<filename>` **and** are named in `output_files`.
- `skill_files[].skill_name` is the **slug** returned by `load_skill`, not the title.

> Put the whole argument block in the skill's instructions as a **copy-exact JSON
> snippet, not prose bullets.** Models copy blocks reliably and skip bullets. This
> was measured as the difference between a 26-minute failure loop and a first-try
> success.

### Minimise round trips

Every extra tool call pays a full prefill — tens of seconds at tier 1.

---

## 11. Fine-tuning

Fine-tuning is a **format and behaviour** tool, not a speed or knowledge tool.

| Goal | Fine-tuning? |
|---|---|
| Reliable tool names and arguments | ✅ ideal |
| House output conventions | ✅ ideal |
| Bounded formats, less rambling | ✅ ideal |
| Domain vocabulary and tone | ✅ good |
| Faster answers | ❌ — quantization, placement, hardware |
| Knows your documents | ❌ — retrieval, which the platform already does |

### What is possible at each tier

| Tier | Feasible | Typical stack |
|---|---|---|
| 1 | LoRA / QLoRA on 7B–13B; layer-streamed LoRA on larger | Unsloth, peft, llama.cpp finetune |
| 2 | LoRA on 70B; full fine-tune of 7B–13B | peft + DeepSpeed ZeRO, FSDP, Axolotl |
| 3 | Full fine-tune of 70B+; continued pre-training | Megatron-LM, DeepSpeed, FSDP across nodes |

**Layer streaming** (tier 1) holds the frozen base in system RAM and feeds the GPU
one decoder layer at a time, so only the adapter and one layer occupy VRAM.
Published results claim an 8B LoRA within ~3.3 GB peak at ~120 training tok/s —
roughly 2.3 hours per million tokens.

⚠ Evaluate such claims carefully: confirm whether a quoted throughput is
**training** or **inference**; whether quantization is involved (usually yes); and
whether it is LoRA or full fine-tuning.

### Workflow

1. **Fix the platform side first.** Most apparent model failures are configuration
   or skill-authoring defects.
2. **Collect real traces** — runs where the model got a tool call wrong.
3. **Start small.** A 4B that fits entirely in VRAM and follows the contract often
   beats a larger one that spills.
4. **Evaluate against the real task**, using the platform's own eval tooling.
5. **Register the tuned model** like any other (§7).

---

## 12. Use-case fit

| Well suited to local | Better hosted (or tier 3) |
|---|---|
| Document Q&A over a private corpus | Long multi-step agentic chains |
| Classification, tagging, routing | Substantial code generation |
| Extraction into fixed schemas | Latency-sensitive interactive chat |
| Summarisation | Tasks needing frontier reasoning |
| Template-filling and structured reports | Bursty high-concurrency workloads |
| Air-gapped or regulated environments | Rapid prototyping |

**A hybrid deployment is usually right.** Route bulk, privacy-sensitive and
structured work to local models; route long agentic chains and heavy code
generation to a hosted model. The platform selects provider and model per request,
so this needs configuration, not code.

---

## 13. Deployment checklists

### Every tier

- [ ] Model supports native tool calling, **verified with a real tool round trip**
- [ ] **Registry row created**: `native_tools`, loaded `context_window_tokens`,
      `max_output_tokens`, timeout
- [ ] End-to-end verification: a tool call, a tool-result round trip, and a file
      written to `/sandbox/output/` and delivered
- [ ] Skills reviewed for bounded output and explicit tool arguments

### Tier 1 — workstation

- [ ] Measured free VRAM with the real desktop workload running
- [ ] Model fits the envelope, verified against **actual file size**
- [ ] Loaded at **32k context minimum**
- [ ] Batch size swept; peak identified; Shared GPU memory at baseline
- [ ] "Remember settings" enabled so tuning survives a reload
- [ ] Timeouts sized for local latency — minutes, not seconds

### Tier 2–3 — server

- [ ] Model fits in VRAM across the chosen `--tensor-parallel-size` with **no CPU offload**
- [ ] `--max-model-len` set to real need, not the model maximum
- [ ] `--max-num-seqs` tuned against actual concurrency and an explicit latency SLO
- [ ] Benchmarked at **aggregate** throughput, not single-request latency
- [ ] Prefix caching confirmed working — system prompt and tool schemas should not
      re-prefill every turn
- [ ] Application `WORKER_COUNT` raised in step with server concurrency
- [ ] Timeouts tightened to `120–300` s — a slow call here is a fault
- [ ] Failover decided: which hosted model, if any, catches overflow

---

## Appendix — reference measurements **[measured]**

Recorded on an **NVIDIA RTX 4050 Laptop GPU (6 GB)** with 47.7 GB system RAM — a
**tier-1** machine. Shape and order of magnitude, not targets. **No tier-2/3
figure in this guide was measured by us.**

| Metric | Value |
|---|---|
| Desktop VRAM overhead (browser + IDE + tray) | ~1.3 GB |
| Tool-schema cost, default 28-tool set | 4,730–6,933 tokens |
| Prefill, well-tuned batch | 350–1,000+ tok/s |
| Prefill with VRAM spill | ~310 tok/s |
| Generation, 20B MoE MXFP4 | 11.6 tok/s |
| Generation, 9B dense Q4 (spilling) | 10.0 tok/s |
| Context budget at a 32,768 window | 18,368 tokens |
| Full agentic document task, local | ~26 minutes |
| Same task, hosted mid-tier model | ~69 seconds |

⚠ The same 28 tools cost **4,730 tokens** on one model and **6,933** on another —
purely a tokenizer difference, worth ~2,200 tokens of usable context.
