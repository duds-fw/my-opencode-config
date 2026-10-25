# Severity vocabulary

Severity tracks impact, not taste.

- **critical** — data loss, a forged verdict, a broken permission, or a
  silent pass on a control that must never pass.
- **high** — a wrong verdict on a realistic path, a regression in a core
  invariant, or a control measurably weakened.
- **medium** — a real defect on an edge path, an error code that does not
  match the contract, a guard that cannot fire in an unusual configuration.
- **low** — a genuine correctness smell with no impact on a current path.

A fix that weakens a control is a **high** finding even when it makes the
failing test pass.
