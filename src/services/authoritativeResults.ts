/** Read every visible row; never treat an error or truncated page as an empty reset. */
export async function readResultRows(query: () => any): Promise<any[]> {
  const rows: any[] = [];
  const ids = new Set<string>();
  let expected: number | undefined;
  for (;;) {
    const { data, count, error } = await query().range(rows.length, rows.length + 199);
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0)
      throw new Error('Data Supabase belum dapat dibaca lengkap.');
    if (expected !== undefined && expected !== count)
      throw new Error('Data berubah saat sinkronisasi. Silakan muat ulang.');
    expected = count;
    for (const row of data) {
      if (!row?.id || ids.has(String(row.id))) throw new Error('Data sinkronisasi tidak konsisten.');
      ids.add(String(row.id));
      rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (!data.length || rows.length > count) throw new Error('Data Supabase belum lengkap.');
  }
}
