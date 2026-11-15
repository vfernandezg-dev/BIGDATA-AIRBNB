import type { ReactNode } from "react";

export type Column<Row> = {
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right";
};

type DataTableProps<Row> = {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
};

export function DataTable<Row>({ caption, columns, rows, rowKey }: DataTableProps<Row>) {
  return (
    <table className="tabular w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.header}
              scope="col"
              className={`sticky top-0 whitespace-nowrap border-b border-axis bg-surface px-2 py-2 text-xs font-medium text-ink-2 ${
                column.align === "right" ? "text-right" : "text-left"
              }`}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-grid last:border-0 hover:bg-wash">
            {columns.map((column, index) => {
              const className = `whitespace-nowrap px-2 py-1.5 ${column.align === "right" ? "text-right" : "text-left"}`;
              return index === 0 ? (
                <th key={column.header} scope="row" className={`${className} font-normal text-ink`}>
                  {column.cell(row)}
                </th>
              ) : (
                <td key={column.header} className={`${className} text-ink-2`}>
                  {column.cell(row)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
