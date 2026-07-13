import type { CSSProperties } from "react";

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey?: (row: T, index: number) => string;
}) {
  const renderMobileCards = rows.length <= 30;
  return (
    <div className="min-w-0 max-w-full">
      {renderMobileCards ? (
        <div className="grid gap-3 bg-surfaceWarm p-3 md:hidden">
          {rows.map((row, rowIndex) => (
            <article
              className="motion-admin-row grid min-w-0 gap-3 rounded-[1.15rem] border border-line bg-white p-3 shadow-[0_12px_30px_rgba(3,10,20,0.06)] min-[380px]:gap-3.5 min-[380px]:p-4"
              key={rowKey?.(row, rowIndex) ?? rowIndex}
              style={{ "--motion-delay": `${Math.min(rowIndex, 8) * 45}ms` } as CSSProperties}
            >
              {columns.map((column) => (
                <div className="grid min-w-0 grid-cols-[minmax(4.5rem,34%)_minmax(0,1fr)] gap-2 min-[380px]:gap-3" key={column.key}>
                  <dt className="min-w-0 font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-dim min-[380px]:text-[0.65rem]">
                    {column.label}
                  </dt>
                  <dd className="min-w-0 text-sm leading-6 text-ink [overflow-wrap:anywhere]">{column.render(row)}</dd>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : null}
      <div className={[renderMobileCards ? "hidden md:block" : "block", "max-w-full overflow-x-auto"].join(" ")}>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surfaceWarm">
              {columns.map((column) => (
                <th
                  className={[
                    "whitespace-nowrap px-4 py-3.5 font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim",
                    column.className ?? ""
                  ].join(" ")}
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, rowIndex) => (
              <tr
                className="motion-admin-row bg-white align-top transition hover:bg-surfaceWarm"
                key={rowKey?.(row, rowIndex) ?? rowIndex}
                style={{ "--motion-delay": `${Math.min(rowIndex, 8) * 35}ms` } as CSSProperties}
              >
                {columns.map((column) => (
                  <td className={["px-4 py-4 leading-6 lg:px-5", column.className ?? ""].join(" ")} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
