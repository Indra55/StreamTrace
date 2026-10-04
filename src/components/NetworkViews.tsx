import { useMemo } from "react";
import type { InvestigationResult } from "../../engine/index.ts";
import { siteSummary, type DemoState, type Network } from "../demo.ts";
interface Props {
  data: Network;
  result: InvestigationResult;
  state: DemoState;
  onSelect: (code: string) => void;
  reducedMotion: boolean;
}
export const reachState = (id: string, result: InvestigationResult) =>
  result.candidates.includes(id)
    ? result.candidates.length === 1
      ? "Priority area"
      : "Candidate"
    : "Eliminated";
export function NetworkList({ data, result, state, onSelect }: Props) {
  return (
    <div className="list-view">
      <p className="view-note">
        The full study network. Select a site to record an observation.
      </p>
      <h3>Observation sites</h3>
      <ul className="site-list">
        {data.sites.map((s) => (
          <li key={s.code}>
            <button
              onClick={() => onSelect(s.code)}
              aria-label={`Open site ${s.code}`}
            >
              <span className="site-badge">{s.code}</span>
              <span>
                {siteSummary(state, s.code)}
                <small>
                  {result.recommendation?.siteCode === s.code
                    ? "Check here next"
                    : "Access unreviewed"}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          </li>
        ))}
      </ul>
      <h3>
        Reaches <span className="count-label">{data.reaches.length}</span>
      </h3>
      <div className="reach-table">
        <table>
          <caption className="sr-only">
            Reach names, identifiers and candidate states
          </caption>
          <thead>
            <tr>
              <th scope="col">Reach</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {data.reaches.map((r) => (
              <tr key={r.id} tabIndex={0}>
                <td>
                  {r.names.join(" / ") || "Unnamed tributary"}
                  <small>{r.id}</small>
                </td>
                <td>{reachState(r.id, result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function NetworkDiagram({
  data,
  result,
  state,
  onSelect,
  reducedMotion,
}: Props) {
  const layout = useMemo(() => {
    const nodes = new Map<
      number,
      { incoming: number[]; outgoing: number[]; level: number; y: number }
    >();
    for (const r of data.reaches) {
      if (!nodes.has(r.fromNode))
        nodes.set(r.fromNode, { incoming: [], outgoing: [], level: 0, y: 0 });
      if (!nodes.has(r.toNode))
        nodes.set(r.toNode, { incoming: [], outgoing: [], level: 0, y: 0 });
      nodes.get(r.fromNode)!.outgoing.push(r.toNode);
      nodes.get(r.toNode)!.incoming.push(r.fromNode);
    }
    function level(id: number): number {
      const n = nodes.get(id)!;
      n.level = n.incoming.length ? 1 + Math.max(...n.incoming.map(level)) : 0;
      return n.level;
    }
    for (const id of nodes.keys()) level(id);
    const sources = [...nodes.keys()]
      .filter((id) => !nodes.get(id)!.incoming.length)
      .sort((a, b) => a - b);
    sources.forEach((id, i) => (nodes.get(id)!.y = 42 + i * 36));
    function y(id: number): number {
      const n = nodes.get(id)!;
      if (n.incoming.length)
        n.y = n.incoming.reduce((sum, p) => sum + y(p), 0) / n.incoming.length;
      return n.y;
    }
    for (const id of nodes.keys()) y(id);
    const max = Math.max(...[...nodes.values()].map((n) => n.level));
    const position = (id: number) => ({
      x: 40 + nodes.get(id)!.level * (900 / Math.max(max, 1)),
      y: nodes.get(id)!.y,
    });
    return { nodes, position, height: Math.max(230, sources.length * 36 + 60) };
  }, [data]);
  const candidate = new Set(result.candidates);
  return (
    <div className="diagram-view">
      <p className="view-note">
        Schematic connections only. Left to right follows provisional downstream
        flow.
      </p>
      <div className="diagram-scroll">
        <svg
          viewBox={`0 0 1000 ${layout.height}`}
          role="group"
          aria-label="Stream network schematic, flowing left to right"
        >
          <title>Coimbra stream connectivity</title>
          {data.reaches.map((r) => {
            const a = layout.position(r.fromNode),
              b = layout.position(r.toNode),
              active = candidate.has(r.id),
              single = active && candidate.size === 1;
            return (
              <path
                key={r.id}
                d={`M ${a.x},${a.y} C ${a.x + 24},${a.y} ${b.x - 24},${b.y} ${b.x},${b.y}`}
                fill="none"
                stroke={single ? "#a34924" : active ? "#245b83" : "#bac3c5"}
                strokeWidth={single ? 6 : active ? 3 : 1.5}
                className={active && !reducedMotion ? "reach-flow" : ""}
              >
                <title>
                  {r.names.join(" / ") || "Unnamed tributary"}:{" "}
                  {reachState(r.id, result)}
                </title>
              </path>
            );
          })}
          {[...layout.nodes].map(([id]) => {
            const p = layout.position(id);
            return <circle key={id} cx={p.x} cy={p.y} r={3} fill="#53636b" />;
          })}
          {data.sites.map((s) => {
            const p = layout.position(s.osmNodeId),
              next = result.recommendation?.siteCode === s.code;
            return (
              <g
                key={s.code}
                transform={`translate(${p.x},${p.y})`}
                role="button"
                tabIndex={0}
                className="diagram-site"
                aria-label={`Open site ${s.code}: ${siteSummary(state, s.code)}`}
                onClick={() => onSelect(s.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s.code);
                  }
                }}
              >
                {next && (
                  <circle r={22} fill="none" stroke="#245b83" strokeWidth={2} />
                )}
                <circle
                  r={15}
                  fill="#fdfcf7"
                  stroke="#173f5e"
                  strokeWidth={2}
                />
                <text textAnchor="middle" dy={4}>
                  {s.code}
                </text>
                <text textAnchor="middle" y={-25}>
                  {next
                    ? "Check here next"
                    : siteSummary(state, s.code) === "No observations"
                      ? ""
                      : siteSummary(state, s.code)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="diagram-footnote">
        A schematic is available even when background map tiles cannot load.
      </p>
    </div>
  );
}
