#!/usr/bin/env node
/*
 * Copyright 2025 Ahmed Mustufa Malik
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// ---------- logging ----------
function log(
  level: "INFO" | "ERROR" | "DEBUG" | "WARN",
  message: string,
  data?: unknown
) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${message}`;
  if (data !== undefined) {
    console.error(`${line}\n${JSON.stringify(data, null, 2)}`);
  } else {
    console.error(line);
  }
}

// ---------- env / config ----------
const requiredEnv = z.object({
  DB_SERVER: z.string().min(1),
  DB_DATABASE: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
});
const optionalEnv = z.object({
  DB_PORT: z.string().optional(),
  DB_SSL: z.string().optional(),
});

const okRequired = requiredEnv.safeParse(process.env);
if (!okRequired.success) {
  log(
    "ERROR",
    "Missing required env: DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD"
  );
  process.exit(1);
}
const opt = optionalEnv.parse(process.env);

const dbConfig = {
  host: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(opt.DB_PORT || "3306", 10),
  // For AWS RDS MySQL, SSL often needs to be enabled; `mysql2` supports `ssl: 'Amazon RDS'`.
  ssl: process.env.DB_SSL === "false" ? undefined : "Amazon RDS",
  connectTimeout: 60_000,
};

log("INFO", "Starting MCP (STDIO) with DB config (sans password):", {
  host: dbConfig.host,
  database: dbConfig.database,
  user: dbConfig.user,
  port: dbConfig.port,
  ssl: !!dbConfig.ssl,
});

// ---------- DB pool ----------
let pool: mysql.Pool | null = null;
async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    log("INFO", "Creating MySQL pool…");
    pool = mysql.createPool(dbConfig as mysql.PoolOptions);
    // smoke test:
    const [rows] = await pool.query("SELECT 1 AS ok");
    log("INFO", "DB test ok", rows);
  }
  return pool;
}

// ---------- MCP server ----------
const server = new McpServer({
  name: "mysql-mcp",
  version: "1.2.3",
});

// execute_query
server.registerTool(
  "execute_query",
  {
    title: "Execute SQL",
    description: "Execute a SQL query on the MySQL database (read-focused)",
    inputSchema: { query: z.string().min(1) },
  },
  async ({ query }: { query: string }) => {
    const upper = query.trim().toUpperCase();
    if (
      upper.startsWith("DROP") ||
      upper.startsWith("DELETE") ||
      upper.startsWith("TRUNCATE")
    ) {
      log("WARN", "Destructive operation blocked", { query });
      return {
        content: [
          {
            type: "text",
            text: "Error: Destructive operations (DROP/DELETE/TRUNCATE) are not allowed.",
          },
        ],
        isError: true,
      };
    }

    const p = await getPool();
    log("DEBUG", "Executing query", { query });
    const [rows] = await p.query(query);
    log("INFO", "Query executed", {
      rows: Array.isArray(rows) ? rows.length : 0,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

// list_tables
server.registerTool(
  "list_tables",
  {
    title: "List Tables",
    description: "List all base tables in the current database",
    inputSchema: {},
  },
  async () => {
    const p = await getPool();
    const [rows] = await p.query(
      `
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
      `
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

// describe_table
server.registerTool(
  "describe_table",
  {
    title: "Describe Table",
    description: "Get the schema of a table",
    inputSchema: { table_name: z.string().min(1) },
  },
  async ({ table_name }: { table_name: string }) => {
    const p = await getPool();
    const [rows] = await p.query(
      `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH,
             NUMERIC_PRECISION, NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
      `,
      [table_name]
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

// Primary keys for a table
server.registerTool(
  "primary_keys",
  {
    title: "Primary Keys",
    description: "Get primary key column(s) for a table.",
    inputSchema: { table_name: z.string().min(1) },
  },
  async ({ table_name }) => {
    const p = await getPool();
    const [rows] = await p.query(
      `
      SELECT k.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
        ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       AND t.TABLE_SCHEMA = k.TABLE_SCHEMA
       AND t.TABLE_NAME = k.TABLE_NAME
      WHERE t.TABLE_SCHEMA = DATABASE()
        AND t.TABLE_NAME = ?
        AND t.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY k.ORDINAL_POSITION
      `,
      [table_name]
    );
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// get_table_data
server.registerTool(
  "get_table_data",
  {
    title: "Get Table Data",
    description: "Return sample rows from a table",
    inputSchema: {
      table_name: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(10).optional(),
    },
  },
  async ({
    table_name,
    limit = 10,
  }: {
    table_name: string;
    limit?: number | undefined;
  }) => {
    const p = await getPool();
    const safe = Math.min(Math.max(1, limit), 100);
    const [rows] = await p.query(`SELECT * FROM \`${table_name}\` LIMIT ?`, [
      safe,
    ]);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "search_columns",
  {
    title: "Search Columns",
    description: "Find columns whose names match a pattern (case-insensitive).",
    inputSchema: { like: z.string().min(1) },
  },
  async ({ like }: { like: string }) => {
    const p = await getPool();
    const [rows] = await p.query(
      `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION
      `,
      [`%${like}%`]
    );
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

// Foreign keys in/out of a table
server.registerTool(
  "foreign_keys",
  {
    title: "Foreign Keys",
    description: "List foreign keys referencing or referenced by a table.",
    inputSchema: { table_name: z.string().min(1) },
  },
  async ({ table_name }: { table_name: string }) => {
    const p = await getPool();
    const [rows] = await p.query(
      `
      SELECT kcu.TABLE_NAME,
             kcu.COLUMN_NAME,
             kcu.REFERENCED_TABLE_NAME,
             kcu.REFERENCED_COLUMN_NAME,
             kcu.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND (kcu.TABLE_NAME = ? OR kcu.REFERENCED_TABLE_NAME = ?)
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
      `,
      [table_name, table_name]
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

// One-shot snapshot the whole schema (tables, columns, PKs, FKs)
server.registerTool(
  "introspect_schema",
  {
    title: "Introspect Schema",
    description: "Return a compact JSON map of tables → columns, PKs, and FKs.",
    inputSchema: {},
  },
  async () => {
    const p = await getPool();
    const [tables] = await p.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    const [cols] = await p.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const [pks] = await p.query(`
      SELECT k.TABLE_NAME, k.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
        ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       AND t.TABLE_SCHEMA = k.TABLE_SCHEMA
       AND t.TABLE_NAME = k.TABLE_NAME
      WHERE t.TABLE_SCHEMA = DATABASE() AND t.CONSTRAINT_TYPE='PRIMARY KEY'
    `);

    const [fks] = await p.query(`
      SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME,
             kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    // Build a compact map
    const map: any = {};
    for (const t of tables as any[])
      map[t.TABLE_NAME] = { columns: [], pk: [], fks: [] };
    for (const c of cols as any[])
      map[c.TABLE_NAME]?.columns.push({
        name: c.COLUMN_NAME,
        type: c.DATA_TYPE,
        nullable: c.IS_NULLABLE === "YES",
      });
    for (const k of pks as any[]) map[k.TABLE_NAME]?.pk.push(k.COLUMN_NAME);
    for (const fk of fks as any[])
      map[fk.TABLE_NAME]?.fks.push({
        column: fk.COLUMN_NAME,
        refTable: fk.REFERENCED_TABLE_NAME,
        refColumn: fk.REFERENCED_COLUMN_NAME,
      });

    return { content: [{ type: "text", text: JSON.stringify(map, null, 2) }] };
  }
);

// ---------- STDIO transport ----------
(async () => {
  await getPool(); // early DB test for fast failures
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // No HTTP server; process stays alive while stdio session is open.
})().catch((e) => {
  log("ERROR", "Fatal startup", e);
  process.exit(1);
});
