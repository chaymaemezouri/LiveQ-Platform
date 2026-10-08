import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { LiveResult } from '@/lib/live';

export function ResultChart({
  results,
  correctOptionId,
}: {
  results: LiveResult[];
  correctOptionId?: string | null;
}) {
  const rows = results.map((result) => ({ ...result, name: result.label }));

  return (
    <figure aria-label="Results" className="mt-6">
      <div className="text-foreground h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: 'currentColor', fontSize: 12 }}
            />
            <Bar dataKey="percent" radius={[0, 6, 6, 0]} barSize={16}>
              {rows.map((row) => (
                <Cell
                  key={row.optionId}
                  fill={
                    row.optionId === correctOptionId ? 'var(--ring)' : 'var(--primary)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 space-y-2">
        {results.map((result) => (
          <li
            key={result.optionId}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>
              {result.label}
              {result.optionId === correctOptionId ? (
                <span className="text-muted-foreground ml-2 text-xs tracking-wide uppercase">
                  Correct
                </span>
              ) : null}
            </span>
            <span>
              {result.percent}% · {result.count}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
