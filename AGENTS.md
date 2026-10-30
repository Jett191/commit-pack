<!-- entire-agent:begin -->
Read .entire/agent-guide.md for this repository's workflow, source inspection, and verification guidance.
@.entire/agent-guide.md
<!-- entire-agent:end -->

For code or workflow changes, run `pnpm run lint`, `pnpm test`, and `pnpm run build`
before reporting completion. Keep initialization repair regression tests in the
standard test suite; CI must run them on pushes, PRs to main, and before release.
