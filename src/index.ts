#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import sql from 'mssql';

// Database configuration from environment variables
const dbConfig: sql.config = {
  server: process.env.MSSQL_SERVER || 'localhost',
  database: process.env.MSSQL_DATABASE || 'master',
  user: process.env.MSSQL_USERNAME || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

// Validate required environment variables
if (!process.env.MSSQL_SERVER || !process.env.MSSQL_DATABASE || !process.env.MSSQL_USERNAME || !process.env.MSSQL_PASSWORD) {
  console.error('Missing required environment variables: MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USERNAME, MSSQL_PASSWORD');
  process.exit(1);
}

const server = new Server(
  {
    name: 'mssql-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Database connection pool
let pool: sql.ConnectionPool | null = null;

async function getConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
  }
  return pool;
}

// Tools definition
const tools: Tool[] = [
  {
    name: 'execute_query',
    description: 'Execute a SQL query on the MSSQL database',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL query to execute',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_tables',
    description: 'List all tables in the current database',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'describe_table',
    description: 'Get the schema/structure of a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'The name of the table to describe',
        },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'get_table_data',
    description: 'Get sample data from a table (limited to 100 rows)',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'The name of the table to get data from',
        },
        limit: {
          type: 'number',
          description: 'Number of rows to return (default: 10, max: 100)',
          default: 10,
        },
      },
      required: ['table_name'],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const connection = await getConnection();

    switch (name) {
      case 'execute_query': {
        const { query } = args as { query: string };
        
        // Basic safety check for destructive operations
        const upperQuery = query.toUpperCase().trim();
        if (upperQuery.startsWith('DROP') || upperQuery.startsWith('DELETE') || upperQuery.startsWith('TRUNCATE')) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Destructive operations (DROP, DELETE, TRUNCATE) are not allowed for safety reasons.',
              },
            ],
          };
        }

        const result = await connection.request().query(query);
        
        return {
          content: [
            {
              type: 'text',
              text: `Query executed successfully.\nRows affected: ${result.rowsAffected}\nResults:\n${JSON.stringify(result.recordset, null, 2)}`,
            },
          ],
        };
      }

      case 'list_tables': {
        const result = await connection.request().query(`
          SELECT 
            TABLE_NAME,
            TABLE_SCHEMA,
            TABLE_TYPE
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);

        return {
          content: [
            {
              type: 'text',
              text: `Tables in database:\n${JSON.stringify(result.recordset, null, 2)}`,
            },
          ],
        };
      }

      case 'describe_table': {
        const { table_name } = args as { table_name: string };
        
        const result = await connection.request()
          .input('table_name', sql.VarChar, table_name)
          .query(`
            SELECT 
              COLUMN_NAME,
              DATA_TYPE,
              IS_NULLABLE,
              COLUMN_DEFAULT,
              CHARACTER_MAXIMUM_LENGTH,
              NUMERIC_PRECISION,
              NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @table_name
            ORDER BY ORDINAL_POSITION
          `);

        return {
          content: [
            {
              type: 'text',
              text: `Schema for table '${table_name}':\n${JSON.stringify(result.recordset, null, 2)}`,
            },
          ],
        };
      }

      case 'get_table_data': {
        const { table_name, limit = 10 } = args as { table_name: string; limit?: number };
        const safeLimit = Math.min(Math.max(1, limit), 100);
        
        const result = await connection.request()
          .input('table_name', sql.VarChar, table_name)
          .query(`SELECT TOP ${safeLimit} * FROM [${table_name}]`);

        return {
          content: [
            {
              type: 'text',
              text: `Sample data from table '${table_name}' (${safeLimit} rows):\n${JSON.stringify(result.recordset, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MSSQL MCP server running on stdio');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});