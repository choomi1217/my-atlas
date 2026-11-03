interface AgentVerdictCountsProps {
  pass: number;
  fail: number;
  inconclusive: number;
}

/** PASS / FAIL / 판정불가 건수 */
export default function AgentVerdictCounts({
  pass,
  fail,
  inconclusive,
}: AgentVerdictCountsProps) {
  return (
    <span className="flex gap-2 text-xs">
      <span className="text-green-600">PASS {pass}</span>
      <span className="text-red-600">FAIL {fail}</span>
      <span className="text-yellow-600">판정불가 {inconclusive}</span>
    </span>
  );
}
