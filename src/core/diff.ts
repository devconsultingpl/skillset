/**
 * Minimal line diff via longest-common-subsequence. Returns one line per row,
 * prefixed with `  ` (context), `- ` (only in `a`), or `+ ` (only in `b`).
 * No dependency — enough to show a user what an overwrite would change.
 */
export function lineDiff(a: string, b: string): string {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;

  // dp[i][j] = LCS length of A[i:] and B[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push(`  ${A[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${A[i]}`);
      i++;
    } else {
      out.push(`+ ${B[j]}`);
      j++;
    }
  }
  while (i < n) out.push(`- ${A[i++]}`);
  while (j < m) out.push(`+ ${B[j++]}`);
  return out.join("\n");
}
