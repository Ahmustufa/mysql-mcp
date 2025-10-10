#!/usr/bin/env node
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
  version: "1.1.0",
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
