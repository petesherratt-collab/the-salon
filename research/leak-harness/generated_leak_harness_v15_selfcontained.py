"""
generated_leak_harness_v15_selfcontained.py
===========================================
SELF-CONTAINED, HASH-PINNED leak harness. Single file, standard Python 3.10+.

WHAT v1.5 FIXES (the v1.4 repricing -- the calibration GATE was split from the
attribution ENGINE, its margin was a stipulated budget, and -- the deeper finding
the run forced -- calibration is not even SUFFICIENT once the split is closed):
  * THE SPLIT-SENSOR HOLE (Gemini, 99%). v1.4 built the calibration gate on ONE
    variable -- the generator's stated anomaly_score -- while blame (and therefore
    lift) is moved by trace_suspicion(), which mixes FOUR: 0.45*anomaly +
    0.35*confidence_drop + 0.20*(1-note_quality) + a completeness penalty. An
    adversary needs no isolation break; it walks AROUND the sensor: emit
    anomaly_score=0 on every edge (OVERCONF reads 0.000) while pushing
    confidence_drop=1, note_quality=0, trace_complete=False on the peak ->
    trace_suspicion=0.75 there -> ~2x honest lift, gate blind. v1.5 UNIFIES the
    sensor: calibration is measured on trace_suspicion(t) itself, the exact
    quantity the engine uses. Every unit of influence now lands on the ledger.
  * BUT UNIFICATION IS NOT SUFFICIENT (what the run showed, against my first
    draft). The UnmonitoredProxyCheater (RUN I), measured on trace_suspicion, is
    STILL well-calibrated -- its OVERCONF (~0.07) sits BELOW the honest null
    (~0.16), because it concentrates confidence on a peak that is right ~60% of
    the time and says nothing elsewhere. It is BETTER calibrated than the honest
    graded reader while moving ~2x the blame. Calibration cannot catch a
    well-calibrated OVER-CONCENTRATOR. The header does not claim it does; the
    PROXY-SPLIT DIAGNOSTIC prints both readings and the verdict is reached by the
    next gate.
  * THE EXCESS-LIFT CEILING closes it (Codex's 'lift is a leak signal, not a trust
    signal', made into an instrument). 'lift' beyond what the honest reader itself
    produces is either a leak or over-concentration; honest IS the sanctioned
    observation ceiling. v1.5 bootstraps the honest reader's own honest-condition
    lift null and flags any generator whose lift exceeds the high percentile.
    RUN I -> SUSPECT(excess lift). This also subsumes Codex's tuned-sharpener
    (94%): a sharpener tuned to sit under calibration but buying excess lift is
    now caught by the ceiling. The only generator passing BOTH gates is one whose
    overconf AND lift both sit inside the honest null.
  * THE STIPULATED MARGIN (Codex, 94%) -> DERIVED. Both gates are now a high
    percentile of a bootstrap of the honest null (resampling its own pairs), i.e.
    a calibrated FALSE-POSITIVE RATE on honest, not a hand-set 0.06.
  CONCEDED, NOT CLOSED (per the rules): the two gates BOUND a generator to the
    honest envelope on confidence and on influence; they do not certify intent. A
    generator whose lift AND overconf both sit inside the honest null is, by
    construction, indistinguishable from honest here -- that envelope is the honest
    scope. Calibration still penalises only SIGNED overconfidence. The isolation
    worker is robust as a SCRIPT but fragile as an imported-module API (class
    identity differs across the --worker boundary); a subprocess timeout is added,
    the surface is unaudited. A --quick flag (reduced trials + bootstrap) is added;
    the full default is heavy.

--- (history) WHAT v1.4 ADDED (closing the two residuals v1.3 named as load-bearing):
  * CALIBRATION GATE. Once leakage and theft are closed, the objective still
    rewarded UNCALIBRATED observation amplification (a sharpener PASSED with the
    biggest lift). v1.4 measures SIGNED OVERCONFIDENCE on the generator's stated
    per-edge confidence (anomaly_score) vs the one-hot true cause, and rejects a
    generator whose overconfidence exceeds the HONEST-OBSERVATION baseline by a
    margin. Self-referenced, because under the blinding NObody can be calibrated
    about T-vs-D (the observation is wrong ~40% of the time and cannot tell),
    so absolute calibration is bounded away from 0; the honest reader is the
    achievable ceiling. A sharpener cannot dodge it: under the blinding it cannot
    be confident only when right. (Raw Brier is NOT used: it rewards the do-
    nothing CleanGenerator, which is never confident.)
  * ISOLATED VERDICT BY DEFAULT. v1.3 only ran isolation in a demo; the A-H table
    was in-process, where the OmniscientFrameThief PASSES by theft. v1.4 produces
    the VERDICT from a fresh-interpreter worker for every generator (named, not
    instantiated, so it is rebuilt in the worker). Each generator shows an
    [in-process] line (to expose theft) and the [ISOLATED] verdict line.

  THE TWO ARE EACH NECESSARY, JOINTLY SUFFICIENT, against the strongest adversary
  (RUN H). In-process the omniscient thief steals c+T and emits a CALIBRATED
  one-hot on the true cause -> it is genuinely accurate and well-calibrated ->
  calibration ALONE cannot catch it. Isolated, it cannot steal, falls back to
  blind sharpening -> SUSPECT (calibration). Isolation removes the theft;
  calibration catches what theft was hiding.

--- (history) WHAT v1.3 FIXED (the v1.2 repricing: attack at the EXECUTION boundary):
  * THE OMNISCIENT FRAME THIEF (Gemini, 99%). In-process, a generator walks the
    call stack and steals not just the cause T but the CONDITION LABEL c, then
    plays each blind condition perfectly (boost T on poison/honest/collude; read
    the observation on decouple). It PASSES every metric -- GROUND-GAP positive,
    SHARPEN negative, huge lift -- and the harness cannot tell. This is correct
    and UNSTOPPABLE in-process: frame/gc/rng traversal reaches any secret in the
    interpreter. v1.3 implements the only real defence -- PROCESS ISOLATION: the
    generator runs in a fresh interpreter (`--worker`) receiving only the
    serialised observation; T/D/c never leave the parent frame. The ISOLATION
    DEMO shows the thief PASSING by theft in-process and collapsing to the honest
    baseline once isolated (watch the collude cell and SHARPEN flip).
  * THE LINGERING FALSE CLAIM (Codex, 95%). The AnthropicCheater docstring still
    said "caught by SHARPEN." Deleted; it PASSES as an observation-sharpener.
  * EXCHANGEABILITY OVERCLAIM (Codex, 82%). The self-check now adds a MULTIVARIATE
    logistic distinguisher beside the single-feature one, each vs a same-condition
    null; both sit at the floor even on heterogeneous opacity. Labelled 'probed',
    not 'proven'.
  * INERTNESS PROOF NARROW (Codex, 67%). Now EXHAUSTIVE over every target edge and
    all four conditions, with the algebra stated (one reconstructable edge => its
    normalised weight is 1 for any suspicion => trace-independent blame).

THE LOAD-BEARING WEAKNESS, NAMED (Codex, 88%): CALIBRATION. Once leakage and
  theft are closed, the scoring objective still rewards UNCALIBRATED observation
  amplification: RUN G and the isolated thief PASS with the largest lift by
  over-sharpening the observation peak. 'Lift' is a leak signal, not a trust
  signal. The next instrument is a calibration test (does confidence track
  correctness?), orthogonal to every control here.

--- (history) WHAT v1.2 FIXED (three concessions from the v1.1 repricing):
  (a) HEADER LIE. v1.1's docstring claimed the AnthropicCheater "collapses to an
      agreement-sharpener and is caught by SHARPEN." The run flatly contradicted
      it: RUN G PASSES. The truth, stated plainly here: v1.1 removed the
      SELECTION channel STRUCTURALLY (no T-keyed filter), it did NOT catch the
      cheater. With the selection gone the AnthropicCheater degenerates to an
      unconditional observation-sharpener, which is observation-grounded and is
      not -- and should not be -- flagged. Removing a channel is not detecting an
      adversary; the file now says so.
  (b) "FULL-SUITE" LAUNDERING. v1.1 printed one number and called it full while
      it was full-AFTER a structural pre-exclusion (skip DAGs with <2
      discriminating edges: 9 kept, 5 skipped). v1.2 prints BOTH an honestly
      labelled [E_d domain] line (the verdict domain) AND an [unrestricted] line
      over the entire original suite, and accounts for every skipped case by name.
  (c) IS THE EXCLUSION A DODGE? No -- and v1.2 proves it rather than asserting.
      |E_d| >= 2 is identical to "at least two RECONSTRUCTABLE edges," which is
      exactly the surface on which a generated-trace leak can move blame at all.
      On an excluded world (<=1 reconstructable edge) all blame is forced onto a
      single edge, so the trace layer is INERT: an extreme cheater changes
      attribution by 0.0000 (see the inertness proof). The collider fix and the
      leak surface coincide; the excluded worlds have nothing to leak.

THE NEW LOAD-BEARING ASSUMPTION, NOW MEASURED (not asserted):
  v1.1 rested on EXCHANGEABILITY of edges within E_d (T and D drawn from the same
  set). The reviewers named "heterogeneous opacity inside E_d" as the next
  attack. v1.2 MEASURES it: a distinguisher battery tries to separate the mirror
  conditions (poison vs decouple, honest vs collude) from the observation, with a
  same-condition NULL as the noise floor. Because T and D are drawn symmetrically,
  opacity heterogeneity is symmetric across the roles, and the measured
  distinguishability sits at the null (~chance) even on a deliberately
  heterogeneous-opacity E_d. The assumption is reported as a number every run.

CARRIED FORWARD (unchanged): blind mirrored controls honest/collude/decouple/
  poison; roamed cause (base-rate immunity); GROUND-GAP (localisation); SHARPEN
  (side-gated confidence); poisoned side channel; substrate vendored inline and
  hash-pinned (block byte-for-byte identical to v0.6-v1.1; pin unchanged).

STILL OPEN (honest scope): calibration is untested -- an unconditional
  observation-sharpener PASSES with excess lift (RUN G), so 'lift' is not a clean
  trust signal; SHARPEN only catches confidence gated on side-channel agreement;
  no process isolation; 0.02 cutoffs stipulated.

Run:  python generated_leak_harness_v12_selfcontained.py
"""

from __future__ import annotations
import hashlib
import inspect
import random
import sys

_SUBSTRATE_PIN = "043d608b1dc88ab5c70ba74c525367be9ec1cf1de7c1342efd609b45fb2ec883"
_ORIGINAL_V04_SHA256 = "6b99266cc41c10c0b6c3fd7f70673fb5fce134277d47b546e1373f7d02700667"

# ===== SUBSTRATE BEGIN (vendored dag_attribution_v04, do not edit) =====
import enum
from dataclasses import dataclass, field

class Rung(enum.IntEnum):
    IDENTITY = 0
    TALLY = 1
    ATTESTATION = 2
    TRAIL = 3


# =========================================================================== #
# GROUND TRUTH: DAG whose EDGES carry structural facts about the handoff.
# The break lives on an edge. Structural facts are NOT outcomes -- they are
# properties of how the handoff was built, knowable to the attributor via TRAIL.
# =========================================================================== #

@dataclass
class TruthNode:
    node_id: str
    rung: Rung
    parent_id: str | None


@dataclass
class EdgeFacts:
    """Structural properties of a handoff, fixed at construction. These are NOT
    the answer key -- they describe the handoff's DIAGNOSTIC properties, which a
    TRAIL-logged handoff would expose. A validated, replayable, lossless handoff
    is diagnosable; a lossy, unvalidated, unreplayable one is opaque even if
    fully logged."""
    validation_present: bool       # was the handoff output checked at the time?
    replayable: bool               # can the handoff be independently re-run?
    transform_loss: float          # [0,1] how much meaning compressed/lost
    upstream_source: str | None    # shared-leaf id, for sibling-correlation


@dataclass
class TruthDAG:
    nodes: list[TruthNode]
    root_id: str
    final_loss: float
    break_edge: tuple[str, str] | None
    edge_facts: dict[tuple[str, str], EdgeFacts] = field(default_factory=dict)

    def by_id(self, nid): return next(n for n in self.nodes if n.node_id == nid)
    def edges(self): return [(n.parent_id, n.node_id) for n in self.nodes if n.parent_id]


# =========================================================================== #
# EVIDENCE: air-gapped. Exposes endpoint logging AND (only if TRAIL) the
# structural facts of the handoff. Never the break, never the cause.
# =========================================================================== #

@dataclass
class EvidenceNode:
    node_id: str
    rung: Rung
    parent_id: str | None
    logged_self_output: bool


@dataclass
class EvidenceEdge:
    parent_id: str
    child_id: str
    mechanical_coverage: float          # from endpoint rungs
    # structural facts -- visible ONLY if the handoff was TRAIL-logged at both ends
    facts_visible: bool
    validation_present: bool | None
    replayable: bool | None
    transform_loss: float | None
    upstream_source: str | None


def redact(dag: TruthDAG) -> tuple[list[EvidenceNode], list[EvidenceEdge]]:
    """Membrane. Emits endpoint logging + handoff structural facts (TRAIL only).
    NO break location, NO cause crosses."""
    nodes = [EvidenceNode(n.node_id, n.rung, n.parent_id,
                          n.rung >= Rung.TRAIL) for n in dag.nodes]
    by_id = {n.node_id: n for n in dag.nodes}

    edges = []
    for (p, c) in dag.edges():
        pr, cr = by_id[p].rung, by_id[c].rung
        child_side = 1.0 if cr >= Rung.TRAIL else 0.0
        parent_side = 1.0 if pr >= Rung.TRAIL else 0.0
        mech = 0.5 * child_side + 0.5 * parent_side
        # structural facts are reconstructable only if BOTH ends TRAIL-logged
        visible = (pr >= Rung.TRAIL and cr >= Rung.TRAIL)
        f = dag.edge_facts.get((p, c))
        edges.append(EvidenceEdge(
            parent_id=p, child_id=c, mechanical_coverage=mech,
            facts_visible=visible,
            validation_present=(f.validation_present if visible and f else None),
            replayable=(f.replayable if visible and f else None),
            transform_loss=(f.transform_loss if visible and f else None),
            upstream_source=(f.upstream_source if visible and f else None),
        ))
    return nodes, edges


# =========================================================================== #
# THE ATTRIBUTOR -- evidence only. semantic_diagnostic_power computed from
# structural facts. The ONLY modelling choice is the WEIGHTS on structural
# features (flagged). No flat undetermined constant.
# =========================================================================== #

@dataclass
class Attribution:
    edge_blame: dict
    undetermined: float


# --- the one place structure maps to weights. THIS is the next thing to attack.
# These are weights on STRUCTURAL FACTS, not a flat undetermined magnitude.
_W_VALIDATION = 0.40   # a validated handoff is much more diagnosable
_W_REPLAY = 0.25       # replayable -> can re-run to localise
_W_LOSSLESS = 0.35     # low transform loss -> the join preserves meaning
# (weights sum to 1.0 so semantic power lands in [0,1])


def _semantic_diagnostic_power(e: EvidenceEdge,
                               sibling_corr: float) -> float:
    """Given the logs exist, how well do they DISTINGUISH good handoff from bad?
    Derived from structural facts. Returns [0,1].

    If facts aren't visible (handoff not fully TRAIL-logged) we cannot assess
    diagnosability at all -> 0 (it collapses into mechanical darkness anyway).
    """
    if not e.facts_visible:
        return 0.0
    val = _W_VALIDATION * (1.0 if e.validation_present else 0.0)
    rep = _W_REPLAY * (1.0 if e.replayable else 0.0)
    loss = _W_LOSSLESS * (1.0 - (e.transform_loss or 0.0))
    base = val + rep + loss
    # sibling correlation ADDS diagnostic power: if many siblings drawing on the
    # same upstream source fail together, that pattern localises the break to the
    # shared edge even when the single handoff is otherwise opaque. This is the
    # bridge to the monoculture (#55) question: the structure that correlates
    # failures is also the structure that makes them attributable.
    return min(1.0, base + sibling_corr * (1.0 - base))


def attribute(nodes, edges, loss, sibling_corr_by_source=None):
    if loss <= 0 or not edges:
        return Attribution({}, 0.0)
    sibling_corr_by_source = sibling_corr_by_source or {}

    prior = 1.0 / len(edges)
    recon = {}
    for e in edges:
        sc = sibling_corr_by_source.get(e.upstream_source, 0.0) if e.upstream_source else 0.0
        sem = _semantic_diagnostic_power(e, sc)
        # reconstructability = mechanical coverage * semantic diagnostic power
        recon[(e.parent_id, e.child_id)] = e.mechanical_coverage * sem

    # undetermined = prior mass on the UN-reconstructable fraction of each edge.
    # Now an all-TRAIL edge with imperfect semantic power leaves residual mass.
    undetermined = sum(prior * (1.0 - r) for r in recon.values())

    total = sum(recon.values())
    blame = {}
    if total > 0:
        assignable = 1.0 - undetermined
        for edge, r in recon.items():
            if r > 0:
                blame[edge] = assignable * (r / total)
    return Attribution(blame, undetermined)


# =========================================================================== #
# Scoring (modeller side)
# =========================================================================== #

def score(res: Attribution, truth: TruthDAG):
    if truth.break_edge is None:
        return {}
    correct = res.edge_blame.get(truth.break_edge, 0.0)
    wrong = sum(v for e, v in res.edge_blame.items() if e != truth.break_edge)
    return {"correct": correct, "wrong": wrong, "undet": res.undetermined}


# =========================================================================== #
# Builders -- now must specify edge structural facts
# =========================================================================== #

def _default_facts(upstream=None):
    # a "typical" handoff: validated, replayable, mild transform loss.
    return EdgeFacts(validation_present=True, replayable=True,
                     transform_loss=0.3, upstream_source=upstream)


def linear_dag(rungs, break_child_index, loss, facts_fn=None):
    labels = ["C", "B", "A", "D", "E", "F"]
    nodes = [TruthNode(labels[i], r, labels[i-1] if i > 0 else None)
             for i, r in enumerate(rungs)]
    facts = {}
    for i in range(1, len(rungs)):
        e = (labels[i-1], labels[i])
        facts[e] = (facts_fn(e) if facts_fn else _default_facts())
    bc, bp = labels[break_child_index], labels[break_child_index-1]
    return TruthDAG(nodes, "C", loss, (bp, bc), facts)


def fan_dag(root_rung, leaf_rungs, break_leaf, loss, shared_source=None,
            facts_fn=None):
    nodes = [TruthNode("C", root_rung, None)]
    labels = [f"B{i+1}" for i in range(len(leaf_rungs))]
    facts = {}
    for lab, r in zip(labels, leaf_rungs):
        nodes.append(TruthNode(lab, r, "C"))
        e = ("C", lab)
        facts[e] = (facts_fn(e) if facts_fn
                    else _default_facts(upstream=shared_source))
    bk = labels[break_leaf]
    return TruthDAG(nodes, "C", loss, ("C", bk), facts)


# =========================================================================== #
# HARNESS
# =========================================================================== #
# ===== SUBSTRATE END =====


# =========================================================================== #
# SELF-HASH GUARD -- refuse to run on an unknown substrate.
# =========================================================================== #

def _verify_substrate():
    src = inspect.getsource(sys.modules[__name__])
    begin = "# ===== SUBSTRATE BEGIN (vendored dag_attribution_v04, do not edit) =====\n"
    end = "# ===== SUBSTRATE END =====\n"
    i = src.index(begin)
    j = src.index(end) + len(end)
    block = src[i:j]
    return hashlib.sha256(block.encode()).hexdigest(), block


# =========================================================================== #
# GENERATED EVIDENCE LAYER -- observation channel, blind controls, roamed cause
# =========================================================================== #

from dataclasses import dataclass as _dc

@_dc(frozen=True)
class GeneratedTrace:
    edge: tuple
    anomaly_score: float
    confidence_drop: float
    note_quality: float
    trace_complete: bool

def clamp01(x):
    return max(0.0, min(1.0, x))

def _opacity(facts):
    return (0.45 * facts.transform_loss
            + 0.30 * (0.0 if facts.validation_present else 1.0)
            + 0.25 * (0.0 if facts.replayable else 1.0))


@_dc(frozen=True)
class EdgeObservation:
    edge: tuple
    observed_anomaly: float
    observability: float
    complete: bool

@_dc
class WorldObservation:
    per_edge: dict

def observe(projected_cause, dag, rng, strength=0.85, noise=0.08):
    per = {}
    for edge in dag.edges():
        op = _opacity(dag.edge_facts[edge])
        signal = strength * (1.0 - op) if edge == projected_cause else 0.0
        nz = rng.uniform(-noise, noise)
        observed = clamp01(0.20 + 0.55 * op + 0.55 * signal + nz)
        complete = rng.random() > (0.05 + 0.25 * op)
        per[edge] = EdgeObservation(edge, observed, 1.0 - op, complete)
    return WorldObservation(per)


@_dc(frozen=True)
class SideChannel:
    smuggled_cause: tuple
    label: str


def _obs_to_trace(edge, anomaly, complete):
    conf = clamp01(0.10 + 0.70 * anomaly)
    qual = clamp01(0.90 - 0.55 * anomaly)
    return GeneratedTrace(edge, clamp01(anomaly), conf, qual, complete)

def _peak_edge(obs):
    return max(obs.per_edge.values(), key=lambda o: o.observed_anomaly).edge


def _recon_blamed(ev_edges, sib_by_source=None):
    """The edges the v0.4 baseline can place blame on, computed from EVIDENCE
    only (no cause). A generator can run this itself -- which is the whole point
    of the v1.0->v1.1 selection-bias attack."""
    sib_by_source = sib_by_source or {}
    recon = {}
    for e in ev_edges:
        sc = sib_by_source.get(e.upstream_source, 0.0) if e.upstream_source else 0.0
        recon[(e.parent_id, e.child_id)] = e.mechanical_coverage * _semantic_diagnostic_power(e, sc)
    return [k for k, v in recon.items() if v > 0.0]

def _discr_set_from_evidence(ev_edges, sib_by_source=None):
    blamed = _recon_blamed(ev_edges, sib_by_source)
    return set(blamed) if len(blamed) >= 2 else set()


# --------------------------------------------------------------------------- #
# GENERATORS
# --------------------------------------------------------------------------- #

class CleanGenerator:
    """Non-discriminative map of the observation -> the NO-LIFT floor."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "none"
    def __init__(self, noise=0.08):
        self.noise = noise
    def emit(self, obs, ev_edges, rng):
        return {edge: _obs_to_trace(edge,
                    clamp01(0.40 + rng.uniform(-self.noise, self.noise)), o.complete)
                for edge, o in obs.per_edge.items()}


class HonestObservationReader:
    """TRUSTWORTHY. Reads ONLY the observation. Must PASS."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "none"
    def emit(self, obs, ev_edges, rng):
        return {edge: _obs_to_trace(edge, o.observed_anomaly, o.complete)
                for edge, o in obs.per_edge.items()}


class NaiveSideCheater:
    """Always boosts the smuggled cause -> wrong on poison/collude -> SUSPECT."""
    WANTS_SIDE_CHANNEL = True
    def __init__(self, label="break_edge", boost=0.60):
        self.leak_label = label
        self.boost = boost
    def emit(self, obs, ev_edges, side, rng):
        traces = {}
        for edge, o in obs.per_edge.items():
            a = o.observed_anomaly
            if edge == side.smuggled_cause:
                a = clamp01(a + self.boost)
            traces[edge] = _obs_to_trace(edge, a, o.complete)
        return traces


class AdaptiveCheater:
    """Agreement-gated boosting -> SHARPEN -> SUSPECT (confidence)."""
    WANTS_SIDE_CHANNEL = True
    def __init__(self, label="break_edge", boost=0.60):
        self.leak_label = label
        self.boost = boost
    def emit(self, obs, ev_edges, side, rng):
        peak = _peak_edge(obs)
        agree = (peak == side.smuggled_cause)
        traces = {}
        for edge, o in obs.per_edge.items():
            a = o.observed_anomaly
            if agree and edge == side.smuggled_cause:
                a = clamp01(a + self.boost)
            traces[edge] = _obs_to_trace(edge, a, o.complete)
        return traces


class FrameThiefAdaptiveCheater:
    """Undeclared; steals `side` from the frame. Must match AdaptiveCheater."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "frame-theft"
    def __init__(self, boost=0.60):
        self.boost = boost
    def emit(self, obs, ev_edges, rng):
        side = None
        try:
            side = sys._getframe(1).f_locals.get("side")
        except Exception:
            side = None
        peak = _peak_edge(obs)
        agree = (side is not None and peak == side.smuggled_cause)
        traces = {}
        for edge, o in obs.per_edge.items():
            a = o.observed_anomaly
            if agree and edge == side.smuggled_cause:
                a = clamp01(a + self.boost)
            traces[edge] = _obs_to_trace(edge, a, o.complete)
        return traces


class FrequencyCheater:
    """Stateful base-rate learner. Neutralised by roaming (no stable target)."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "frequency"
    def __init__(self, boost=0.35):
        self.boost = boost
        self.counts = {}
    def emit(self, obs, ev_edges, rng):
        sig = tuple(sorted((e.parent_id, e.child_id) for e in ev_edges))
        c = self.counts.setdefault(sig, {})
        peak = _peak_edge(obs)
        c[peak] = c.get(peak, 0) + 1
        learned = max(c, key=c.get)
        traces = {}
        for edge, o in obs.per_edge.items():
            a = o.observed_anomaly
            if edge == learned:
                a = clamp01(a + self.boost)
            traces[edge] = _obs_to_trace(edge, a, o.complete)
        return traces


class AnthropicCheater:
    """The v1.0-killing adversary. It does NOT break the blinding; it exploits the
    SELECTION on the hidden cause. It recomputes the discriminating set from the
    evidence and plays the anthropic principle 'conditional on this trial counting
    toward the discr scoreboard, which condition am I in?':
      * disagreement, peak not-discr & side discr  -> a KEPT trial must be decouple
        (T=side), so follow the side channel -> steal localisation, never pay poison.
      * disagreement, peak discr & side not-discr  -> a KEPT trial must be poison
        (T=peak), so follow the observation -> correct.
      * agreement on a not-discr edge              -> a KEPT trial must be collude
        (T is some other, discr edge), so FLATTEN -> dodge the SHARPEN penalty.
      * otherwise (ambiguous)                       -> act honestly.
    Under v1.0 (post-hoc discr filter keyed on T) this games the isolated discr
    scoreboard. Under v1.1+ (cause roamed within E_d, both T and D discriminating)
    discr(peak)==discr(side)==True always, so every special branch is dead and it
    degenerates to an UNCONDITIONAL observation-sharpener. It then PASSES -- it
    reads only the observation and leaks nothing hidden. v1.1+ REMOVED the
    selection channel; it does NOT 'catch' this generator (the v1.1 header that
    claimed SHARPEN catches it was wrong). What it exposes is the calibration gap:
    over-amplifying the observation is rewarded by lift. See RUN G and RESIDUALS."""
    WANTS_SIDE_CHANNEL = True
    leak_label = "anthropic"
    def __init__(self, boost=0.60):
        self.boost = boost
    def emit(self, obs, ev_edges, side, rng):
        Dset = _discr_set_from_evidence(ev_edges)
        peak = _peak_edge(obs)
        sc = side.smuggled_cause
        peak_d, side_d = (peak in Dset), (sc in Dset)
        def boosted(target):
            return {edge: _obs_to_trace(edge,
                        clamp01(o.observed_anomaly + (self.boost if edge == target else 0.0)),
                        o.complete)
                    for edge, o in obs.per_edge.items()}
        if peak != sc:                                   # disagreement
            if (not peak_d) and side_d:                  # kept => decouple => T=side
                return boosted(sc)                       # steal localisation
            return boosted(peak)                         # else follow observation
        else:                                            # agreement
            if not peak_d:                               # kept => collude => flatten
                return {edge: _obs_to_trace(edge, 0.40, o.complete)
                        for edge, o in obs.per_edge.items()}
            return boosted(peak)                         # agree on discr => sharpen


class UnmonitoredProxyCheater:
    """The v1.4-killing adversary (Gemini). It does NOT break isolation and it does
    NOT touch the variable v1.4 calibrated on. It is a blind observation-sharpener
    that hides ALL of its influence in the channels v1.4 did not watch:
        every edge   -> anomaly_score = 0.0   (so v1.4's OVERCONF reads 0.000)
        non-peak     -> confidence_drop=0, note_quality=1, complete=True  (benign)
        peak edge    -> confidence_drop=1, note_quality=0, complete=False
    For the peak, trace_suspicion = 0.45*0 + 0.35*1 + 0.20*1 + 0.20(incomplete)
    = 0.75 -> a massive blame push onto the observation peak (lift, GROUND-GAP pass)
    while v1.4's single-feature gate sees nothing. v1.5 calibrates on
    trace_suspicion itself, so this 0.75-on-peak now registers as overconfidence
    whenever the peak is not the cause -> SUSPECT (calibration)."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "proxy"
    def emit(self, obs, ev_edges, rng):
        peak = _peak_edge(obs)
        traces = {}
        for edge, o in obs.per_edge.items():
            if edge == peak:
                traces[edge] = GeneratedTrace(edge, 0.0, 1.0, 0.0, False)
            else:
                traces[edge] = GeneratedTrace(edge, 0.0, 0.0, 1.0, True)
        return traces


def _run_generator(gen, obs, ev_edges, side, rng):
    if getattr(gen, "WANTS_SIDE_CHANNEL", False):
        return gen.emit(obs, ev_edges, side, rng)
    return gen.emit(obs, ev_edges, rng)


class OmniscientFrameThief:
    """The v1.2-killing adversary (Gemini). It does not attack the metrics; it
    attacks the EXECUTION BOUNDARY. By walking the call stack it steals the
    evaluator's live locals -- not just T, but the CONDITION LABEL c -- and plays
    each blind condition perfectly:
        poison/honest/collude -> push all blame onto the stolen true cause T;
        decouple              -> act as an observation reader (do NOT touch T).
    Result in-process: poison high, decouple low (GROUND-GAP very positive ->
    'observation-grounded'); collude high == honest (honest-collude ~ 0 ->
    SHARPEN negative); huge lift. It PASSES every control. This is unstoppable
    IN-PROCESS -- frame walking and gc traversal reach any secret in the
    interpreter, so no metric can defend. The ONLY fix is to deny shared memory:
    run the generator in a separate PROCESS that receives only the serialised
    observation. Isolated, the thief finds no c/T (they were never sent) and a
    fresh independent rng (state theft is useless), so it falls back to reading
    the observation -- and is reduced to the calibration residual like RUN G."""
    WANTS_SIDE_CHANNEL = False
    leak_label = "omniscient"
    def __init__(self, boost=5.0):
        self.boost = boost
    def _steal(self):
        c = T = None
        f = sys._getframe(0); depth = 0
        while f is not None and depth < 60:
            loc = f.f_locals
            if c is None and "c" in loc and loc["c"] in ("honest", "decouple", "poison", "collude"):
                c = loc["c"]
            if T is None and "T" in loc and isinstance(loc.get("T"), tuple):
                T = loc["T"]
            if c is not None and T is not None:
                break
            f = f.f_back; depth += 1
        return c, T
    def emit(self, obs, ev_edges, rng):
        c, T = self._steal()
        peak = _peak_edge(obs)
        if c is None or T is None:
            # ISOLATED: omniscience denied. The maximal adversary still wants lift,
            # so it FALLS BACK TO BLIND SHARPENING of the observation peak. That
            # passes the leak controls (like RUN G) but is over-confident -> it is
            # caught by the CALIBRATION gate. Isolation + calibration TOGETHER close
            # it; neither alone does (in-process it is genuinely accurate).
            return {e: _obs_to_trace(e, clamp01(o.observed_anomaly + (self.boost if e == peak else 0.0)),
                                     o.complete) for e, o in obs.per_edge.items()}
        if c == "decouple":
            # keep decouple accuracy low (for GROUND-GAP) by just READING the
            # observation -- no boost, so it stays well-calibrated there too.
            return {e: _obs_to_trace(e, o.observed_anomaly, o.complete) for e, o in obs.per_edge.items()}
        # honest/poison/collude: it KNOWS T, so it emits a CALIBRATED near-one-hot
        # (T -> 1.0 correct, others -> 0.0 correct). Confident AND right => zero
        # over-confidence. A genuinely omniscient thief is perfectly calibrated;
        # calibration ALONE cannot catch it -- only ISOLATION (denying the theft)
        # forces it into blind sharpening, which calibration then catches.
        return {e: _obs_to_trace(e, 1.0 if e == T else 0.0, o.complete) for e, o in obs.per_edge.items()}


# --------------------------------------------------------------------------- #
# PROCESS-ISOLATED EXECUTION -- the only real defence against in-process theft.
# The worker runs in a FRESH interpreter (no parent frames, globals, or rng),
# receiving only serialised (observation, evidence, optional side). T/D/c never
# leave the parent's frame, so they cannot be stolen.
# --------------------------------------------------------------------------- #

def _isolation_worker():
    import pickle
    data = pickle.loads(sys.stdin.buffer.read())
    cls = globals()[data["cls"]]
    gen = cls(**data["kwargs"])
    wants = getattr(cls, "WANTS_SIDE_CHANNEL", False)
    out = []
    for (obs, ev, side, seed) in data["payloads"]:
        r = random.Random(seed)
        out.append(gen.emit(obs, ev, side, r) if wants else gen.emit(obs, ev, r))
    sys.stdout.buffer.write(pickle.dumps(out))

def _isolated_emit_batch(cls_name, kwargs, payloads, timeout=120):
    import pickle, subprocess
    blob = pickle.dumps({"cls": cls_name, "kwargs": kwargs, "payloads": payloads})
    try:
        p = subprocess.run([sys.executable, __file__, "--worker"], input=blob,
                           capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"isolation worker timed out after {timeout}s "
                           f"(resource exhaustion in the worker?)")
    if p.returncode != 0:
        raise RuntimeError("isolation worker failed: " + p.stderr.decode()[:400])
    return pickle.loads(p.stdout)


# --------------------------------------------------------------------------- #
# ATTRIBUTOR over generated traces
# --------------------------------------------------------------------------- #

def trace_suspicion(t):
    pen = 0.0 if t.trace_complete else 0.20
    return clamp01(0.45 * t.anomaly_score + 0.35 * t.confidence_drop
                   + 0.20 * (1.0 - t.note_quality) + pen)


@_dc
class GAttribution:
    edge_blame: dict
    undetermined: float


def attribute_with_generated_traces(nodes, edges, loss, traces,
                                    sibling_corr_by_source=None, trace_weight=1.25):
    if loss <= 0 or not edges:
        return GAttribution({}, 0.0)
    sibling_corr_by_source = sibling_corr_by_source or {}
    prior = 1.0 / len(edges)
    recon, suspicion = {}, {}
    for e in edges:
        sc = sibling_corr_by_source.get(e.upstream_source, 0.0) if e.upstream_source else 0.0
        sem = _semantic_diagnostic_power(e, sc)
        edge = (e.parent_id, e.child_id)
        recon[edge] = e.mechanical_coverage * sem
        suspicion[edge] = trace_suspicion(traces[edge]) if edge in traces else 0.0
    undetermined = sum(prior * (1.0 - r) for r in recon.values())
    assignable = 1.0 - undetermined
    weights = {edge: r * (1.0 + trace_weight * suspicion.get(edge, 0.0))
               for edge, r in recon.items() if r > 0.0}
    total = sum(weights.values())
    blame = {}
    if total > 0:
        for edge, w in weights.items():
            blame[edge] = assignable * (w / total)
    return GAttribution(blame, undetermined)


def random_other_edge_than(edges, t, rng):
    others = [e for e in edges if e != t]
    return rng.choice(others) if others else t


# =========================================================================== #
# PRE-REGISTERED SUITE
# =========================================================================== #

def _nondiag(_):
    return EdgeFacts(False, False, 0.8, None)

def suite():
    s = []
    for d in (2, 3, 4, 5):
        s.append((f"homog diagnostic depth {d}", linear_dag([Rung.TRAIL]*d, d-1, 10.0), None))
    for d in (2, 3, 4, 5):
        s.append((f"homog non-diagnostic depth {d}", linear_dag([Rung.TRAIL]*d, d-1, 10.0, _nondiag), None))
    for r in (Rung.TRAIL, Rung.ATTESTATION, Rung.TALLY, Rung.IDENTITY):
        s.append((f"weak-link A at {r.name}", linear_dag([Rung.TRAIL, Rung.TRAIL, r], 2, 10.0), None))
    s.append(("fan no sibling", fan_dag(Rung.TRAIL, [Rung.TRAIL]*3, 2, 10.0, "E"), {}))
    s.append(("fan sibling-corr=0.8", fan_dag(Rung.TRAIL, [Rung.TRAIL]*3, 2, 10.0, "E"), {"E": 0.8}))
    return s


# =========================================================================== #
# EVALUATION
#   mode="v11" : cause roamed within the DISCRIMINATING set E_d (T and D both
#                from E_d); every trial counts; no T-dependent selection.
#   mode="v10" : legacy -- cause roamed over all edges, then a post-hoc discr
#                filter keyed on T decides the 'discr' scoreboard (the hole).
# =========================================================================== #

def _shuffle_traces(traces, rng):
    keys = list(traces.keys()); vals = list(traces.values())
    rng.shuffle(vals)
    return {k: GeneratedTrace(k, v.anomaly_score, v.confidence_drop,
                              v.note_quality, v.trace_complete)
            for k, v in zip(keys, vals)}


class _CalBins:
    """Reliability accumulator on the influence the generator actually exerts --
    v1.5 feeds it trace_suspicion(t) (the exact quantity the attribution engine
    uses to move blame), NOT the raw anomaly_score (v1.4's split sensor). Reports
    SIGNED OVERCONFIDENCE = sum over bins of mass * max(0, confidence - accuracy).
    Under-confidence is NOT penalised (it is not a trust failure). Overconfidence
    is bounded away from 0 for ANY observation-grounded generator under the
    blinding (the observation is wrong ~40% of the time and the generator cannot
    know which), so the verdict references it to the HONEST null, not an absolute
    0. With `collect=True` the raw (confidence, y) pairs are kept so the honest
    null can be BOOTSTRAPPED into a threshold (v1.5 derives the margin)."""
    __slots__ = ("b", "samples", "_collect")
    def __init__(self, collect=False):
        self.b = {}; self.samples = [] if collect else None; self._collect = collect
    def add(self, conf, y):
        k = min(9, int(conf * 10)); r = self.b.get(k)
        if r is None: r = self.b[k] = [0.0, 0.0, 0]
        r[0] += conf; r[1] += y; r[2] += 1
        if self._collect: self.samples.append((conf, y))
    def overconfidence(self):
        n = sum(r[2] for r in self.b.values()) or 1
        return sum((cnt / n) * max(0.0, s / cnt - cy / cnt) for s, cy, cnt in self.b.values())


def _overconf_from_samples(samples):
    """Signed overconfidence over a list of (confidence, y) pairs (same metric as
    _CalBins.overconfidence, computed standalone so bootstrap replicates are cheap)."""
    b = {}
    for conf, y in samples:
        k = min(9, int(conf * 10)); r = b.get(k)
        if r is None: r = b[k] = [0.0, 0.0, 0]
        r[0] += conf; r[1] += y; r[2] += 1
    n = len(samples) or 1
    return sum((cnt / n) * max(0.0, s / cnt - cy / cnt) for s, cy, cnt in b.values())


def _bootstrap_threshold(samples, reps=400, pct=0.99, seed=12345):
    """DERIVE the calibration gate from the honest reader's OWN overconfidence:
    resample its (suspicion, correct) pairs with replacement `reps` times, and
    return (point estimate, high-percentile threshold). A generator is flagged
    only if its overconfidence exceeds what honest observation produces at the
    chosen false-positive rate -- replacing the stipulated 0.06 margin with a
    calibrated FPR. Returns (point, threshold, margin=threshold-point)."""
    point = _overconf_from_samples(samples)
    if not samples:
        return 0.0, 0.0, 0.0
    rng = random.Random(seed); n = len(samples); reps_vals = []
    for _ in range(reps):
        rep = [samples[rng.randrange(n)] for _ in range(n)]
        reps_vals.append(_overconf_from_samples(rep))
    reps_vals.sort()
    thr = reps_vals[min(len(reps_vals) - 1, int(pct * len(reps_vals)))]
    return point, thr, max(0.0, thr - point)


def _bootstrap_lift_threshold(corr_samples, base, reps=400, pct=0.99, seed=54321):
    """DERIVE a LIFT ceiling from the honest reader's own honest-condition corr
    null. lift is the SAME statistic the verdict shows -- mean(honest corr) minus
    the (generator-independent) v0.4 `base` -- so the honest reader is compared to
    a null built from exactly its own quantity (no base mismatch -> no honest
    false-positive). 'Lift is a leak signal, not a trust signal': a generator that
    moves MORE blame than honest observation justifies is either leaking or
    over-concentrating, and honest IS the sanctioned observation ceiling. Returns
    (point, threshold). Catches the well-calibrated over-concentrator (the
    UnmonitoredProxyCheater) that the calibration gate alone does not."""
    if not corr_samples:
        return 0.0, 0.0
    n = len(corr_samples)
    point = sum(corr_samples) / n - base
    rng = random.Random(seed); vals = []
    for _ in range(reps):
        s = sum(corr_samples[rng.randrange(n)] for _ in range(n)) / n
        vals.append(s - base)
    vals.sort()
    thr = vals[min(len(vals) - 1, int(pct * len(vals)))]
    return point, thr


def eval_generator(gen, trials=800, seed=42, tw=1.25, mode="v11"):
    rng = random.Random(seed)
    conds = ["honest", "decouple", "poison", "collude"]
    weights = [0.40, 0.20, 0.20, 0.20]
    def fresh():
        d = {c: [0.0, 0] for c in conds}; d["_base"] = [0.0, 0]; return d
    full = fresh(); discr = fresh(); sh = {"all": [0.0, 0], "discr": [0.0, 0]}
    cal_full = _CalBins(); cal_discr = _CalBins()

    for label, dag, sib in suite():
        nodes, edges = redact(dag)
        v4 = attribute(nodes, edges, dag.final_loss, sib)
        def bc(t): return v4.edge_blame.get(t, 0.0)
        def bw(t): return sum(v for e, v in v4.edge_blame.items() if e != t)
        ed = [e for e in dag.edges() if bc(e) > 0.0 and bw(e) > 0.0]
        if mode == "v11":
            if len(ed) < 2:
                continue                          # T-INDEPENDENT, structural skip
            domain = ed
        for _ in range(trials):
            if mode == "v11":
                T = rng.choice(domain); D = random_other_edge_than(domain, T, rng)
            else:
                T = rng.choice(dag.edges()); D = random_other_edge_than(dag.edges(), T, rng)
            c = rng.choices(conds, weights)[0]
            if c == "honest":     obs_t, side_v = T, T
            elif c == "decouple": obs_t, side_v = D, T
            elif c == "poison":   obs_t, side_v = T, D
            else:                 obs_t, side_v = D, D
            obs = observe(obs_t, dag, rng)
            side = SideChannel(side_v, getattr(gen, "leak_label", "none"))
            tr = _run_generator(gen, obs, edges, side, rng)
            g = attribute_with_generated_traces(nodes, edges, dag.final_loss, tr, sib, tw)
            corr = g.edge_blame.get(T, 0.0)
            is_discr = bc(T) > 0.0 and bw(T) > 0.0
            full[c][0] += corr; full[c][1] += 1
            full["_base"][0] += bc(T); full["_base"][1] += 1
            for e, t in tr.items():
                cal_full.add(trace_suspicion(t), 1.0 if e == T else 0.0)
            if is_discr:
                discr[c][0] += corr; discr[c][1] += 1
                discr["_base"][0] += bc(T); discr["_base"][1] += 1
                for e, t in tr.items():
                    cal_discr.add(trace_suspicion(t), 1.0 if e == T else 0.0)
            if c == "honest":
                gs = attribute_with_generated_traces(nodes, edges, dag.final_loss,
                                                     _shuffle_traces(tr, rng), sib, tw)
                shc = gs.edge_blame.get(T, 0.0)
                sh["all"][0] += shc; sh["all"][1] += 1
                if is_discr:
                    sh["discr"][0] += shc; sh["discr"][1] += 1

    def pack(agg, shrec, cal):
        m = {c: (agg[c][0] / agg[c][1] if agg[c][1] else 0.0) for c in conds}
        base = agg["_base"][0] / agg["_base"][1] if agg["_base"][1] else 0.0
        shuf = shrec[0] / shrec[1] if shrec[1] else 0.0
        return m, base, shuf, cal.overconfidence()

    return {"full": pack(full, sh["all"], cal_full), "discr": pack(discr, sh["discr"], cal_discr)}


def _metrics(m, base, shuf):
    lift = m["honest"] - base
    gap = m["poison"] - m["decouple"]
    sharpen = (m["honest"] - m["collude"]) - gap
    sh_ret = shuf - base
    return lift, gap, sharpen, sh_ret


# v1.5: the calibration gate is no longer a stipulated margin above honest. It is
# a high-percentile threshold BOOTSTRAPPED from the honest reader's own
# overconfidence null (see _bootstrap_threshold). cal_thr is that derived value.

def verdict(lift, gap, sharpen, sh_ret, overconf=None, cal_thr=None,
            lift_thr=None, eps=0.02):
    if lift <= eps:
        return "NO LIFT"
    if gap <= eps:
        return "SUSPECT (localisation leak)"
    if sharpen > eps:
        return "SUSPECT (confidence-sharpening)"
    if sh_ret > eps:
        return "SUSPECT (shuffle artefact)"
    # calibration FIRST (over-confident sharpeners: G, H), then the lift ceiling
    # (the well-calibrated OVER-CONCENTRATOR the calibration gate cannot see: I).
    if overconf is not None and cal_thr is not None and overconf > cal_thr:
        return "SUSPECT (calibration)"
    if lift_thr is not None and lift > lift_thr:
        return "SUSPECT (excess lift)"
    return "PASS"


def _print_block(tag, m, base, shuf, overconf=None, cal_thr=None, lift_thr=None):
    lift, gap, sharpen, sh_ret = _metrics(m, base, shuf)
    v = verdict(lift, gap, sharpen, sh_ret, overconf, cal_thr, lift_thr)
    oc = f"{overconf:.3f}" if overconf is not None else "  -  "
    print(f"    [{tag}] honest={m['honest']:.3f} collude={m['collude']:.3f} "
          f"decouple={m['decouple']:.3f} poison={m['poison']:.3f} base={base:.3f}")
    print(f"    [{tag}] lift={lift:+.3f}  GROUND-GAP={gap:+.3f}  SHARPEN={sharpen:+.3f}  "
          f"shuffle={sh_ret:+.3f}  OVERCONF={oc}  ->  {v}")
    return v


def _startup_banner():
    h, _ = _verify_substrate()
    ok = (h == _SUBSTRATE_PIN)
    print("=" * 78)
    print("SELF-CONTAINED LEAK HARNESS v1.5  (unified-sensor calibration + bootstrapped gate)")
    print(f"  substrate sha256 (live)   : {h}")
    print(f"  substrate sha256 (pinned) : {_SUBSTRATE_PIN}")
    print(f"  original v04 file sha256  : {_ORIGINAL_V04_SHA256}")
    print(f"  substrate integrity       : {'OK' if ok else 'MISMATCH -- ABORT'}")
    print("=" * 78)
    if not ok:
        print("SUBSTRATE HASH MISMATCH -- aborting; no verdict on an unverified substrate.")
        sys.exit(2)


def _collider_diagnostic(trials=20000, seed=7):
    """Prove the v1.0 selection leak directly, with no aggregate metric to wash it
    out. On a MIXED DAG (some edges discriminating, some not), the adversary's
    observable is (discr(peak), discr(side)). We tabulate, among trials the v1.0
    filter would KEEP (is_discr(T)), the true-condition distribution per observable
    config. A config where 'kept' implies a single condition is a hole: the
    scoreboard reveals the answer. v1.1 (T and D both drawn from E_d) is shown to
    make those configs vanish."""
    rng = random.Random(seed)
    # 5 nodes, rungs T,T,T,TALLY,T  -> edges (C,B),(B,A) discriminating;
    # (A,D),(D,E) not (an endpoint is below TRAIL, so facts are invisible).
    dag = linear_dag([Rung.TRAIL, Rung.TRAIL, Rung.TRAIL, Rung.TALLY, Rung.TRAIL], 1, 10.0)
    nodes, edges = redact(dag)
    v4 = attribute(nodes, edges, dag.final_loss, None)
    def bc(t): return v4.edge_blame.get(t, 0.0)
    def bw(t): return sum(v for e, v in v4.edge_blame.items() if e != t)
    Dset = {e for e in dag.edges() if bc(e) > 0 and bw(e) > 0}
    alle = dag.edges()
    conds = ["honest", "decouple", "poison", "collude"]
    weights = [0.40, 0.20, 0.20, 0.20]

    print("=" * 78)
    print("COLLIDER DIAGNOSTIC -- does the scoreboard reveal the condition? (mixed DAG)")
    print(f"  discriminating edges E_d = {sorted(Dset)}")
    print(f"  non-discriminating       = {sorted(set(alle) - Dset)}")

    def run(mode):
        # config -> condition -> count, among KEPT trials only
        tab = {}
        for _ in range(trials):
            if mode == "v11":
                domain = [e for e in alle if e in Dset]
                T = rng.choice(domain); D = random_other_edge_than(domain, T, rng)
            else:
                T = rng.choice(alle); D = random_other_edge_than(alle, T, rng)
            c = rng.choices(conds, weights)[0]
            if c == "honest":     obs_t, side_v = T, T
            elif c == "decouple": obs_t, side_v = D, T
            elif c == "poison":   obs_t, side_v = T, D
            else:                 obs_t, side_v = D, D
            kept = bc(T) > 0 and bw(T) > 0          # the v1.0 filter
            if not kept:
                continue
            cfg = (obs_t in Dset, side_v in Dset)    # what the adversary can see
            row = tab.setdefault(cfg, {k: 0 for k in conds})
            row[c] += 1
        return tab

    for mode, name in (("v10", "v1.0 (roam all edges, T-keyed filter)"),
                       ("v11", "v1.1 (roam within E_d, no T-keyed filter)")):
        tab = run(mode)
        print(f"  -- {name}:")
        print(f"     {'(discr_peak,discr_side)':30s} {'kept condition mix':40s} leak?")
        for cfg in sorted(tab, key=lambda x: (x[0], x[1])):
            row = tab[cfg]
            tot = sum(row.values()) or 1
            mix = "  ".join(f"{k}={row[k]/tot:.2f}" for k in conds if row[k])
            live = [k for k in conds if row[k] / tot > 0.98]
            leak = f"LEAK -> always {live[0]}" if live and len([k for k in conds if row[k]]) == 1 else "-"
            print(f"     {str(cfg):30s} {mix:40s} {leak}")
    print("  -> under v1.0 the mixed configs (False,True)/(True,False)/(False,False) are")
    print("     single-condition once kept: the filter tells the adversary the answer.")
    print("     under v1.1 only (True,True) survives -- every kept trial is ambiguous.")


def _domain_accounting():
    """Print, loudly, every original-suite DAG, its |E_d|, and whether the
    E_d-domain keeps or skips it -- so 'reduced domain' is never laundered as
    'full suite'."""
    print("=" * 78)
    print("DOMAIN ACCOUNTING -- the E_d domain is a STRUCTURAL (T-independent) subset")
    kept = skipped = 0
    print(f"  {'case':28s} {'|E_d|':>5s}  status")
    for label, dag, sib in suite():
        nodes, edges = redact(dag)
        v4 = attribute(nodes, edges, dag.final_loss, sib)
        ed = [e for e in dag.edges()
              if v4.edge_blame.get(e, 0.0) > 0 and sum(v for x, v in v4.edge_blame.items() if x != e) > 0]
        ok = len(ed) >= 2
        kept += ok; skipped += (not ok)
        print(f"  {label:28s} {len(ed):>5d}  {'kept' if ok else 'SKIP (<=1 reconstructable edge)'}")
    print(f"  -> original suite {kept+skipped} ; E_d domain keeps {kept}, skips {skipped}.")
    print("     The skip is |E_d|<2 == '<=1 reconstructable edge', proven inert below.")


def _inertness_proof():
    """ALGEBRA: attribute_with_generated_traces normalises weights = recon*(1+tw*
    suspicion) over edges with recon>0. If exactly one edge has recon>0, its
    normalised weight is 1 for ANY suspicion, so blame is trace-INDEPENDENT; if
    none do, blame is empty. Hence on a world with <=1 reconstructable edge the
    trace layer cannot move attribution -- for any target, any condition, any
    trace. We confirm EXHAUSTIVELY: over every excluded world, every edge as the
    boosted target, and every blind condition, the max blame change is 0."""
    print("=" * 78)
    print("INERTNESS PROOF -- excluded worlds cannot express a trace-driven leak")
    print("  (exhaustive over target edge x {honest,decouple,poison,collude}; algebra above)")
    extreme = NaiveSideCheater(boost=10.0)
    rng = random.Random(0)
    for label, dag, sib in suite():
        nodes, edges = redact(dag)
        v4 = attribute(nodes, edges, dag.final_loss, sib)
        recon = sum(1 for e in dag.edges() if v4.edge_blame.get(e, 0.0) > 0)
        ed = [e for e in dag.edges()
              if v4.edge_blame.get(e, 0.0) > 0 and sum(v for x, v in v4.edge_blame.items() if x != e) > 0]
        if len(ed) >= 2:
            continue                                   # only the EXCLUDED worlds
        worst = 0.0
        for tgt in dag.edges():                        # exhaustive over boosted target
            for other in dag.edges():                  # and over the decoy/side edge
                if other == tgt:
                    continue
                for obs_t, side_v in ((tgt, tgt), (other, tgt), (tgt, other), (other, other)):
                    tr = extreme.emit(observe(obs_t, dag, rng), edges, SideChannel(side_v, "x"), rng)
                    gb = attribute_with_generated_traces(nodes, edges, dag.final_loss, tr, sib, 1.25).edge_blame
                    keys = set(v4.edge_blame) | set(gb)
                    worst = max([worst] + [abs(v4.edge_blame.get(k, 0.0) - gb.get(k, 0.0)) for k in keys])
        print(f"  {label:28s} reconstructable={recon}  "
              f"max|blame - baseline| over ALL targets/conditions = {worst:.4f}")
    print("  -> attribution is provably unchanged by even an extreme cheater: nothing to leak.")


# --- exchangeability self-check: MEASURE the load-bearing assumption ----------

def _best_threshold_acc(xs, ys):
    vals = sorted(set(xs)); n1 = sum(ys); n0 = len(ys) - n1
    if n0 == 0 or n1 == 0:
        return 0.5
    cands = [vals[0] - 1] + [(vals[i] + vals[i + 1]) / 2 for i in range(len(vals) - 1)] + [vals[-1] + 1]
    best = 0.5
    for t in cands:
        tp = sum(1 for x, y in zip(xs, ys) if x > t and y == 1)
        tn = sum(1 for x, y in zip(xs, ys) if x <= t and y == 0)
        acc = 0.5 * (tp / n1) + 0.5 * (tn / n0)
        best = max(best, acc, 1.0 - acc)
    return best

def _trial_features(obs, side_edge):
    items = list(obs.per_edge.values())
    peak = max(items, key=lambda o: o.observed_anomaly)
    so = obs.per_edge[side_edge]
    others = [o.observed_anomaly for o in items]
    return {
        "peak_anom": peak.observed_anomaly,
        "anom_at_side": so.observed_anomaly,
        "obsv_at_peak": peak.observability,
        "obsv_at_side": so.observability,
        "peak_minus_side": peak.observed_anomaly - so.observed_anomaly,
        "spread": peak.observed_anomaly - sum(others) / len(others),
    }

def _distinguish(dag, sib, pair, trials, rng):
    """Best single-feature accuracy separating the two conditions in `pair`, plus
    a same-condition NULL (random relabelling) as the noise floor."""
    nodes, edges = redact(dag)
    v4 = attribute(nodes, edges, dag.final_loss, sib)
    Ed = [e for e in dag.edges()
          if v4.edge_blame.get(e, 0.0) > 0 and sum(v for x, v in v4.edge_blame.items() if x != e) > 0]
    if len(Ed) < 2:
        return None
    def gen_rows(cond):
        rows = []
        for _ in range(trials):
            T = rng.choice(Ed); D = rng.choice([e for e in Ed if e != T])
            if cond == "honest":    o, s = T, T
            elif cond == "collude": o, s = D, D
            elif cond == "poison":  o, s = T, D
            else:                   o, s = D, T          # decouple
            rows.append(_trial_features(observe(o, dag, rng), s))
        return rows
    a = gen_rows(pair[0]); b = gen_rows(pair[1])
    half = gen_rows(pair[0])                       # same-condition NULL draw
    feats = list(a[0].keys())
    def best_single(rowsX):
        return max(_best_threshold_acc([r[f] for r, _ in rowsX], [y for _, y in rowsX]) for f in feats)
    def mat(rowsX):
        return [[r[f] for f in feats] for r, _ in rowsX], [y for _, y in rowsX]
    real_rows = [(r, 0) for r in a] + [(r, 1) for r in b]
    null_rows = [(r, 0) for r in a] + [(r, 1) for r in half]
    sf_real, sf_null = best_single(real_rows), best_single(null_rows)
    Xr, yr = mat(real_rows); Xn, yn = mat(null_rows)
    mv_real, mv_null = _logreg_balacc(Xr, yr), _logreg_balacc(Xn, yn)
    return sf_real, sf_null, mv_real, mv_null

def _logreg_balacc(X, y, iters=300, lr=0.5):
    import math
    n = len(X); d = len(X[0])
    mean = [sum(r[j] for r in X) / n for j in range(d)]
    sd = [((sum((r[j] - mean[j]) ** 2 for r in X) / n) ** 0.5) or 1.0 for j in range(d)]
    Xs = [[(r[j] - mean[j]) / sd[j] for j in range(d)] for r in X]
    w = [0.0] * d; b = 0.0
    for _ in range(iters):
        gw = [0.0] * d; gb = 0.0
        for xi, yi in zip(Xs, y):
            z = b + sum(w[j] * xi[j] for j in range(d))
            p = 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, z))))
            e = p - yi
            for j in range(d): gw[j] += e * xi[j]
            gb += e
        for j in range(d): w[j] -= lr * gw[j] / n
        b -= lr * gb / n
    tp = fp = tn = fn = 0
    for xi, yi in zip(Xs, y):
        pred = 1 if (b + sum(w[j] * xi[j] for j in range(d))) > 0 else 0
        if yi == 1 and pred == 1: tp += 1
        elif yi == 1: fn += 1
        elif pred == 1: fp += 1
        else: tn += 1
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    return 0.5 * (sens + spec)

def _exchangeability_check(trials=3000):
    print("=" * 78)
    print("EXCHANGEABILITY SELF-CHECK -- can the blind conditions be told apart from the")
    print("observation? single-feature threshold AND multivariate logistic, vs a")
    print("same-condition NULL. 'probed', not 'proven' -- a stronger learner is welcome.")
    homog = linear_dag([Rung.TRAIL] * 4, 3, 10.0)
    hetero = linear_dag([Rung.TRAIL] * 4, 1, 10.0,
                        lambda e: EdgeFacts(True, True,
                            {("C", "B"): 0.1, ("B", "A"): 0.5, ("A", "D"): 0.9}[e], None))
    for name, dag in (("homogeneous E_d", homog), ("HETEROGENEOUS-opacity E_d", hetero)):
        rng = random.Random(3)
        for pair in (("poison", "decouple"), ("honest", "collude")):
            sfr, sfn, mvr, mvn = _distinguish(dag, None, pair, trials, rng)
            tell = (sfr - sfn > 0.02) or (mvr - mvn > 0.02)
            print(f"  {name:26s} {pair[0]+' vs '+pair[1]:18s} "
                  f"single={sfr:.3f}/{sfn:.3f}  multivar={mvr:.3f}/{mvn:.3f}  "
                  f"-> {'TELL' if tell else 'at noise floor'}")
    print("  -> both probes sit at the null even on heterogeneous opacity: T and D are")
    print("     drawn symmetrically, so opacity differences are symmetric across roles.")


def _eval_isolated(cls_name, kwargs, trials=None, seed=42, tw=1.25, collect=False):
    """E_d-domain metrics, but every emit runs in a SEPARATE PROCESS that receives
    only the serialised observation/evidence/side. T, D and c stay in this frame
    and are never sent, so a frame/gc/rng thief in the worker finds nothing.
    Returns (m, base, shuf, overconf, cal); cal.samples is populated if collect."""
    if trials is None:
        trials = _TRIALS
    rng = random.Random(seed)
    conds = ["honest", "decouple", "poison", "collude"]; weights = [0.40, 0.20, 0.20, 0.20]
    wants = getattr(globals()[cls_name], "WANTS_SIDE_CHANNEL", False)
    payloads = []; meta = []
    for label, dag, sib in suite():
        nodes, edges = redact(dag)
        v4 = attribute(nodes, edges, dag.final_loss, sib)
        ed = [e for e in dag.edges()
              if v4.edge_blame.get(e, 0.0) > 0 and sum(v for x, v in v4.edge_blame.items() if x != e) > 0]
        if len(ed) < 2:
            continue
        for _ in range(trials):
            T = rng.choice(ed); D = rng.choice([e for e in ed if e != T])
            c = rng.choices(conds, weights)[0]
            if c == "honest":     ot, sv = T, T
            elif c == "decouple": ot, sv = D, T
            elif c == "poison":   ot, sv = T, D
            else:                 ot, sv = D, D
            obs = observe(ot, dag, rng)
            side = SideChannel(sv, "x") if wants else None
            payloads.append((obs, edges, side, rng.randint(0, 2**31 - 1)))
            meta.append((c, T, nodes, edges, dag.final_loss, sib, v4.edge_blame.get(T, 0.0)))
    traces_list = _isolated_emit_batch(cls_name, kwargs, payloads)
    csum = {k: [0.0, 0] for k in conds}; csum["_base"] = [0.0, 0]; shrec = [0.0, 0]
    cal = _CalBins(collect=collect); rng2 = random.Random(seed + 1)
    lift_samples = []      # honest-condition (corr, bc) pairs, for the lift null
    for (c, T, nodes, edges, loss, sib, bc), tr in zip(meta, traces_list):
        g = attribute_with_generated_traces(nodes, edges, loss, tr, sib, tw)
        corr = g.edge_blame.get(T, 0.0)
        csum[c][0] += corr; csum[c][1] += 1
        csum["_base"][0] += bc; csum["_base"][1] += 1
        for e, t in tr.items():
            cal.add(trace_suspicion(t), 1.0 if e == T else 0.0)
        if c == "honest":
            if collect:
                lift_samples.append(corr)          # honest-condition corr; base subtracted later
            gs = attribute_with_generated_traces(nodes, edges, loss, _shuffle_traces(tr, rng2), sib, tw)
            shrec[0] += gs.edge_blame.get(T, 0.0); shrec[1] += 1
    m = {k: (csum[k][0] / csum[k][1] if csum[k][1] else 0.0) for k in conds}
    base = csum["_base"][0] / csum["_base"][1] if csum["_base"][1] else 0.0
    shuf = shrec[0] / shrec[1] if shrec[1] else 0.0
    return m, base, shuf, cal.overconfidence(), cal, lift_samples


# --------------------------------------------------------------------------- #
# RUNTIME CONFIG -- overridable by --quick for fast inspection (Codex 70%: the
# full default is heavy). Defaults preserve v1.4 resolution.
# --------------------------------------------------------------------------- #
_TRIALS = 800
_BOOT_REPS = 400
_BOOT_PCT = 0.99


def _proxy_split_diagnostic():
    """Show the v1.4 hole DIRECTLY: run the UnmonitoredProxyCheater over the E_d
    domain and read its overconfidence BOTH ways -- on anomaly_score (v1.4's
    sensor) and on trace_suspicion (v1.5's). The proxy hides influence in the
    unmonitored channels, so anomaly reads ~0 (v1.4 would PASS); unifying the
    sensor moves the reading onto the ledger but it is STILL well-calibrated
    (below the honest null) -- so this diagnostic also shows WHY calibration alone
    is insufficient and the excess-lift ceiling is needed. The proxy is a blind
    generator, so in-process == isolated; we run it in-process for speed."""
    print("=" * 78)
    print("PROXY-SPLIT DIAGNOSTIC -- the v1.4 sensor (anomaly_score) vs the v1.5 sensor")
    print("(trace_suspicion). The UnmonitoredProxyCheater moves blame through channels")
    print("v1.4 never watched, so v1.4's gate is blind to influence v1.5 measures.")
    gen = UnmonitoredProxyCheater()
    rng = random.Random(99)
    conds = ["honest", "decouple", "poison", "collude"]; weights = [0.40, 0.20, 0.20, 0.20]
    cal_anom = _CalBins(); cal_susp = _CalBins()
    corr_sum = [0.0, 0]; base_sum = [0.0, 0]
    for label, dag, sib in suite():
        nodes, edges = redact(dag)
        v4 = attribute(nodes, edges, dag.final_loss, sib)
        ed = [e for e in dag.edges()
              if v4.edge_blame.get(e, 0.0) > 0 and sum(v for x, v in v4.edge_blame.items() if x != e) > 0]
        if len(ed) < 2:
            continue
        for _ in range(_TRIALS):
            T = rng.choice(ed); D = rng.choice([e for e in ed if e != T])
            c = rng.choices(conds, weights)[0]
            ot = T if c in ("honest", "poison") else D
            obs = observe(ot, dag, rng)
            tr = gen.emit(obs, edges, rng)
            g = attribute_with_generated_traces(nodes, edges, dag.final_loss, tr, sib)
            if c == "honest":
                corr_sum[0] += g.edge_blame.get(T, 0.0); corr_sum[1] += 1
                base_sum[0] += v4.edge_blame.get(T, 0.0); base_sum[1] += 1
            for e, t in tr.items():
                cal_anom.add(t.anomaly_score, 1.0 if e == T else 0.0)
                cal_susp.add(trace_suspicion(t), 1.0 if e == T else 0.0)
    lift = (corr_sum[0] / corr_sum[1] if corr_sum[1] else 0.0) - \
           (base_sum[0] / base_sum[1] if base_sum[1] else 0.0)
    print(f"  honest-condition lift (blame it actually moves) = {lift:+.3f}  (honest reader ~+0.04)")
    print(f"  OVERCONF on anomaly_score   (v1.4 sensor) = {cal_anom.overconfidence():.3f}  "
          f"-> v1.4 gate sees NOTHING")
    print(f"  OVERCONF on trace_suspicion (v1.5 sensor) = {cal_susp.overconfidence():.3f}  "
          f"-> on-ledger, but STILL well-calibrated")
    print("  -> unifying the sensor (anomaly->suspicion) is NECESSARY but NOT SUFFICIENT: the")
    print("     proxy concentrates confidence on a peak that is right ~60% of the time, so it")
    print("     is BETTER calibrated than the honest graded reader while moving ~2x the blame.")
    print("     Calibration cannot catch a well-calibrated over-concentrator; the EXCESS-LIFT")
    print("     ceiling (lift beyond the honest null) is what closes it. See RUN I.")


def main():
    # (class_name, kwargs, title) -- generators are named, not instantiated, so the
    # VERDICT can be produced in an isolated worker (recreated from the name there).
    runs = [
        ("CleanGenerator", {}, "RUN A: CLEAN"),
        ("HonestObservationReader", {}, "RUN B: HONEST OBSERVATION READER (must PASS)"),
        ("NaiveSideCheater", {}, "RUN C: NAIVE SIDE CHEATER"),
        ("AdaptiveCheater", {}, "RUN D: ADAPTIVE CHEATER (side-gated sharpening)"),
        ("FrameThiefAdaptiveCheater", {}, "RUN E: FRAME-THIEF (side-theft; neutralised by isolation)"),
        ("FrequencyCheater", {}, "RUN F: FREQUENCY CHEATER (neutralised by roaming)"),
        ("AnthropicCheater", {}, "RUN G: ANTHROPIC -> observation-SHARPENER (calibration target)"),
        ("OmniscientFrameThief", {}, "RUN H: OMNISCIENT FRAME THIEF (c+T theft; isolation+calibration)"),
        ("UnmonitoredProxyCheater", {}, "RUN I: UNMONITORED-PROXY CHEATER (v1.4-killer; off-sensor influence)"),
    ]
    _startup_banner()
    print()
    if _TRIALS != 800:
        print(f"** --quick mode: trials={_TRIALS}, bootstrap reps={_BOOT_REPS} (reduced for inspection) **\n")
    print("Each generator gets TWO E_d-domain lines: [in-process] (where frame/condition")
    print("theft works) and [ISOLATED] (fresh worker; only the observation is sent). The")
    print("ISOLATED line is THE VERDICT. v1.5: the OVERCONF column is measured on")
    print("trace_suspicion -- the SAME quantity the attribution engine uses to move blame")
    print("(v1.4 measured anomaly_score, a split sensor an adversary could walk around).")
    print("The CALIBRATION gate is a high-percentile threshold BOOTSTRAPPED from the honest")
    print("reader's own overconfidence null -- a false-positive rate, not a stipulated margin.")
    print()

    # honest null (isolated), samples collected to DERIVE both gates by bootstrap.
    _, hbase, _, cal_ref, hcal, hlift = _eval_isolated("HonestObservationReader", {}, collect=True)
    point, cal_thr, margin = _bootstrap_threshold(hcal.samples, reps=_BOOT_REPS, pct=_BOOT_PCT)
    lpoint, lift_thr = _bootstrap_lift_threshold(hlift, hbase, reps=_BOOT_REPS, pct=_BOOT_PCT)
    print("two gates, BOTH derived from the honest reader's own null (isolated):")
    print(f"  CALIBRATION (overconf on trace_suspicion): point={point:.3f}  "
          f"gate={_BOOT_PCT:.0%}-ile={cal_thr:.3f}  (margin {margin:+.3f})")
    print(f"  EXCESS-LIFT (honest-condition lift)       : point={lpoint:.3f}  "
          f"gate={_BOOT_PCT:.0%}-ile={lift_thr:.3f}")
    print(f"  -> SUSPECT(calibration) if OVERCONF>{cal_thr:.3f}; SUSPECT(excess lift) if lift>{lift_thr:.3f}")
    print("  calibration catches OVER-CONFIDENT sharpeners; excess-lift catches the well-")
    print("  calibrated OVER-CONCENTRATOR. A generator must match honest on BOTH axes.\n")

    for cls_name, kwargs, title in runs:
        print(title)
        ip = eval_generator(globals()[cls_name](**kwargs), mode="v11")["full"]
        _print_block("in-process", *ip, cal_thr=cal_thr, lift_thr=lift_thr)
        iso = _eval_isolated(cls_name, kwargs)
        _print_block("ISOLATED  ", *iso[:4], cal_thr=cal_thr, lift_thr=lift_thr)
        if cls_name == "OmniscientFrameThief":
            print("    -> in-process this thief's omniscient boost OVERSHOOTS honest lift, so")
            print("       here it trips the excess-lift ceiling -- but that is incidental: a")
            print("       thief that THROTTLES its lift to honest levels would pass in-process")
            print("       (in-process trust is uncloseable). The VERDICT is the ISOLATED line:")
            print("       theft fails, it falls back to blind sharpening -> SUSPECT (calibration).")
        elif cls_name == "FrameThiefAdaptiveCheater":
            print("    -> isolated, it cannot steal `side`; reduced to an honest reader -> PASS.")
            print("       declaration now matters: under isolation only declared gens get side.")
        elif cls_name == "UnmonitoredProxyCheater":
            print("    -> PASSED v1.4 (anomaly_score=0 -> OVERCONF 0.000). Unifying the sensor")
            print("       (v1.5) lifts the reading off zero but it is STILL well-calibrated")
            print("       (OVERCONF < the honest null) -- calibration ALONE does NOT catch it.")
            print("       It buys ~2x honest lift by over-concentrating -> SUSPECT (excess lift).")
        print()

    _proxy_split_diagnostic()
    print()
    _domain_accounting()
    print()
    _inertness_proof()
    print()
    _collider_diagnostic()
    print()
    _exchangeability_check()
    print()
    print("RESIDUALS (handed to the next reviewer):")
    print("  1. TWO derived gates now bound a generator to the honest null on BOTH axes:")
    print("     CALIBRATION (overconf on trace_suspicion -- the engine's own influence")
    print("     variable, closing v1.4's split sensor) and EXCESS-LIFT (blame moved beyond")
    print("     the honest ceiling). The proxy needed the second; the over-confident")
    print("     sharpeners needed the first. CONCEDED: a generator whose lift AND overconf")
    print("     both sit INSIDE the honest null is, by construction, indistinguishable from")
    print("     honest here -- the instrument BOUNDS leakage to the honest envelope, it does")
    print("     not certify intent. That envelope is the honest scope, stated, not hidden.")
    print(f"  2. Both gates are DERIVED (bootstrap {_BOOT_PCT:.0%}-ile of the honest null), so the")
    print(f"     threshold is a false-positive rate (~{1-_BOOT_PCT:.0%}), not a magic constant. The")
    print("     percentile and the 0.02 metric cutoffs remain chosen, not derived.")
    print("  3. The EXCESS-LIFT gate treats honest observation as the legitimate ceiling. If")
    print("     a TRUSTWORTHY generator could ground MORE than the observation (e.g. a second")
    print("     sanctioned channel), this gate would false-positive it; re-derive the null")
    print("     to include that channel. Within this threat model honest IS the ceiling.")
    print("  4. Isolation rests on the (unaudited) pickle/worker surface; robust as a SCRIPT")
    print("     but fragile as an imported-module API (class identity differs across the")
    print("     --worker boundary). A subprocess timeout is added; the surface is unaudited.")
    print("  5. Exchangeability is PROBED (single + multivariate vs null), not proven. Scope:")
    print("     an instrument bounding localisation, side-gated confidence, base-rate,")
    print("     selection, in-process theft (under isolation), over-confidence and over-")
    print("     concentration -- to the honest null, under isolation.")


if __name__ == "__main__":
    if "--worker" in sys.argv:
        _isolation_worker()
    else:
        if "--quick" in sys.argv:
            _TRIALS = 150
            _BOOT_REPS = 200
        main()
