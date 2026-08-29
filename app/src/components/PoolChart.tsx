"use client";

// The anonymity set over time.
//
// One series, so no legend — the title names it. One hue, so no categorical
// palette and nothing to validate for colour-vision separation. Recessive
// grid, 2px line, an emphasised endpoint, and a direct label only on the last
// point rather than a number on every one.
//
// Every point is a real balance_of at a historical block. Nothing smoothed.

import { useEffect, useMemo, useRef, useState } from "react";
import { poolSeries, toFloat, type Series } from "@/lib/history";

const W = 760;
const H = 260;
const PAD = { t: 18, r: 16, b: 30, l: 52 };

function fmtCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(2);
}

function fmtDate(unix: number | null): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PoolChart({ symbol = "STRK" }: { symbol?: string }) {
  const [series, setSeries] = useState<Series | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    poolSeries(symbol)
      .then((s) => alive && setSeries(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [symbol]);

  const geom = useMemo(() => {
    if (!series || series.points.length < 2) return null;
    const vals = series.points.map((p) => toFloat(p.value, series.decimals));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // Pad the band so the line never touches the frame.
    const lo = min - (max - min) * 0.15;
    const hi = max + (max - min) * 0.15;

    const x = (i: number) =>
      PAD.l + (i / (vals.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) =>
      PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);

    const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
    const area = `${line} L${x(vals.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;

    // Four recessive gridlines across the band.
    const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);

    return { vals, x, y, line, area, ticks, first: vals[0], last: vals[vals.length - 1] };
  }, [series]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geom || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - PAD.l) / (W - PAD.l - PAD.r);
    const i = Math.round(t * (geom.vals.length - 1));
    setHover(i >= 0 && i < geom.vals.length ? i : null);
  };

  const delta =
    geom && geom.first > 0 ? ((geom.last - geom.first) / geom.first) * 100 : null;

  return (
    <div className="panel-lit p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="display text-2xl text-ash">
            {symbol} shielded in the pool
          </h2>
          <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted">
            The anonymity set over roughly the last million blocks. Every point
            is a live <code className="text-brass">balance_of</code> at a
            historical block — nothing smoothed, nothing modelled.
          </p>
        </div>
        {geom && delta !== null && (
          <div className="text-right">
            <p className="num text-2xl text-ash">{fmtCompact(geom.last)}</p>
            <p
              className={`num text-[12px] ${delta < 0 ? "text-rust" : "text-moss"}`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}% over the span
            </p>
          </div>
        )}
      </div>

      {failed && (
        <p className="py-16 text-center font-mono text-[12px] text-faint">
          rpc unreachable — chart unavailable
        </p>
      )}

      {!failed && !geom && (
        <p className="py-16 text-center font-mono text-[12px] text-faint">
          reading {16} historical blocks…
        </p>
      )}

      {geom && series && (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none"
            style={{ height: "auto" }}
            role="img"
            aria-label={`${symbol} held by the STRK20 privacy pool, sampled at ${series.points.length} blocks between ${series.points[0].block} and ${series.points[series.points.length - 1].block}. It moved from ${fmtCompact(geom.first)} to ${fmtCompact(geom.last)}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="poolfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9963F" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#C9963F" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* recessive grid + y labels */}
            {geom.ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={geom.y(t)}
                  y2={geom.y(t)}
                  stroke="#242935"
                  strokeWidth="1"
                />
                <text
                  x={PAD.l - 10}
                  y={geom.y(t) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="#616A7C"
                >
                  {fmtCompact(t)}
                </text>
              </g>
            ))}

            <path d={geom.area} fill="url(#poolfill)" />
            <path
              d={geom.line}
              fill="none"
              stroke="#C9963F"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* emphasised endpoint */}
            <circle
              cx={geom.x(geom.vals.length - 1)}
              cy={geom.y(geom.last)}
              r="4"
              fill="#C9963F"
              stroke="#12151C"
              strokeWidth="2"
            />

            {/* x axis: only the two real endpoints, read from those blocks */}
            <text
              x={PAD.l}
              y={H - 10}
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill="#616A7C"
            >
              {fmtDate(series.startedAt) || `block ${series.points[0].block}`}
            </text>
            <text
              x={W - PAD.r}
              y={H - 10}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fill="#616A7C"
            >
              {fmtDate(series.endedAt) || "now"}
            </text>

            {/* hover crosshair */}
            {hover !== null && (
              <g>
                <line
                  x1={geom.x(hover)}
                  x2={geom.x(hover)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="#616A7C"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={geom.x(hover)}
                  cy={geom.y(geom.vals[hover])}
                  r="5"
                  fill="#E3B45F"
                  stroke="#12151C"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {/* tooltip, in HTML so it can never be clipped by the viewBox */}
          <div className="mt-3 flex min-h-[34px] items-center justify-between gap-4 rounded-md border border-edge bg-ink px-4 py-2">
            {hover !== null ? (
              <>
                <span className="num text-[12px] text-ash">
                  {fmtCompact(geom.vals[hover])} {symbol}
                </span>
                <span className="num text-[11px] text-faint">
                  block {series.points[hover].block.toLocaleString()}
                </span>
              </>
            ) : (
              <span className="font-mono text-[11px] text-faint">
                hover the chart to read a point
              </span>
            )}
          </div>

          <button
            onClick={() => setShowTable((v) => !v)}
            className="mt-3 font-mono text-[11px] text-faint underline underline-offset-2 hover:text-brass"
          >
            {showTable ? "hide" : "show"} the numbers
          </button>

          {showTable && (
            <div className="mt-3 max-h-56 overflow-auto rounded-md border border-edge">
              <table className="w-full font-mono text-[11px]">
                <thead className="sticky top-0 bg-raised">
                  <tr>
                    <th className="px-3 py-2 text-left font-normal text-faint">Block</th>
                    <th className="px-3 py-2 text-right font-normal text-faint">
                      {symbol}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {series.points.map((p, i) => (
                    <tr key={p.block} className="border-t border-hairline">
                      <td className="px-3 py-1.5 text-muted">
                        {p.block.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right text-ash">
                        {toFloat(p.value, series.decimals).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
