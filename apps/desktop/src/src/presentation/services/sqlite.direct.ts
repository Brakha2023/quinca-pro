import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

export async function getSqliteDatabase(): Promise<Database> {
  if (!db) {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    db = new SQL.Database();
    console.log('✅ Base SQLite initialisée (mode direct, sans worker)');
  }
  return db;
}

export async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getSqliteDatabase();
  database.run(sql, params);
  const results = database.exec(sql);
  return results[0]?.values || [];
}