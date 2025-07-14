import {
  CallToolRequest,
  //ListToolsRequest,
  CallToolResult,
  ListToolsResult,
  Tool,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { DatabaseConnection } from '../db/connection.js';
import { SchemaAnalyzer } from '../db/schema.js';
import { SQLValidator } from '../utils/validation.js';

export class MCPHandlers {
  private db: DatabaseConnection;
  private schemaAnalyzer: SchemaAnalyzer;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.schemaAnalyzer = new SchemaAnalyzer(db);
  }

  public async listTools(): Promise<ListToolsResult> {
    const tools: Tool[] = [
      {
        name: 'execute_query',
        description: 'Execute a SQL query against the database (read-only by default)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL query to execute'
            },
            parameters: {
              type: 'object',
              description: 'Parameters to bind to the query',
              additionalProperties: true
            },
            allowWriteOperations: {
              type: 'boolean',
              description: 'Allow write operations (INSERT, UPDATE, DELETE)',
              default: false
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_table_schema',
        description: 'Get the schema information for a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table'
            },
            schemaName: {
              type: 'string',
              description: 'Schema name (defaults to dbo)',
              default: 'dbo'
            }
          },
          required: ['tableName']
        }
      },
      {
        name: 'list_tables',
        description: 'List all tables in the database',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_database_metadata',
        description: 'Get comprehensive metadata about the database including tables, views, procedures, and functions',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'execute_stored_procedure',
        description: 'Execute a stored procedure',
        inputSchema: {
          type: 'object',
          properties: {
            procedureName: {
              type: 'string',
              description: 'Name of the stored procedure'
            },
            parameters: {
              type: 'object',
              description: 'Parameters to pass to the stored procedure',
              additionalProperties: true
            }
          },
          required: ['procedureName']
        }
      },
      {
        name: 'test_connection',
        description: 'Test the database connection',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];

    return { tools };
  }

  public async callTool(request: CallToolRequest): Promise<CallToolResult> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'execute_query':
          return await this.executeQuery(args);
        
        case 'get_table_schema':
          return await this.getTableSchema(args);
        
        case 'list_tables':
          return await this.listTables();
        
        case 'get_database_metadata':
          return await this.getDatabaseMetadata();
        
        case 'execute_stored_procedure':
          return await this.executeStoredProcedure(args);
        
        case 'test_connection':
          return await this.testConnection();
        
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      
      if (error instanceof McpError) {
        throw error;
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to execute tool ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async executeQuery(args: any): Promise<CallToolResult> {
    const { query, parameters = {}, allowWriteOperations = false } = args;

    if (!query || typeof query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Query parameter is required and must be a string'
      );
    }

    // Validate the query
    const validation = SQLValidator.validateQuery(query, allowWriteOperations);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Query validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Validate parameters
    for (const [key, value] of Object.entries(parameters)) {
      if (!SQLValidator.validateParameter(value, 'varchar')) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameter value for ${key}`
        );
      }
    }

    try {
      const result = await this.db.executeQuery(query, parameters);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              recordset: result.recordset,
              rowsAffected: result.rowsAffected,
              recordCount: result.recordset.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Query execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getTableSchema(args: any): Promise<CallToolResult> {
    const { tableName, schemaName = 'dbo' } = args;

    if (!tableName || typeof tableName !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'tableName parameter is required and must be a string'
      );
    }

    // Sanitize table name
    const sanitizedTableName = SQLValidator.sanitizeIdentifier(tableName);
    const sanitizedSchemaName = SQLValidator.sanitizeIdentifier(schemaName);

    try {
      const schema = await this.schemaAnalyzer.getTableSchema(sanitizedTableName, sanitizedSchemaName);
      
      if (!schema) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Table ${schemaName}.${tableName} not found`
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              schema
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get table schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async listTables(): Promise<CallToolResult> {
    try {
      const tables = await this.schemaAnalyzer.getAllTables();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              tables,
              count: tables.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list tables: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getDatabaseMetadata(): Promise<CallToolResult> {
    try {
      const metadata = await this.schemaAnalyzer.getDatabaseMetadata();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              metadata: {
                tables: metadata.tables.length,
                views: metadata.views.length,
                procedures: metadata.procedures.length,
                functions: metadata.functions.length
              },
              details: metadata
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get database metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async executeStoredProcedure(args: any): Promise<CallToolResult> {
    const { procedureName, parameters = {} } = args;

    if (!procedureName || typeof procedureName !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'procedureName parameter is required and must be a string'
      );
    }

    // Validate procedure name
    if (!SQLValidator.isValidProcedureName(procedureName)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid procedure name format'
      );
    }

    // Validate parameters
    for (const [key, value] of Object.entries(parameters)) {
      if (!SQLValidator.validateParameter(value, 'varchar')) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameter value for ${key}`
        );
      }
    }

    try {
      const result = await this.db.executeStoredProcedure(procedureName, parameters);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              recordset: result.recordset,
              recordsets: result.recordsets,
              output: result.output,
              rowsAffected: result.rowsAffected,
              recordCount: result.recordset.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Stored procedure execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async testConnection(): Promise<CallToolResult> {
    try {
      const isConnected = this.db.isConnected();
      
      if (!isConnected) {
        await this.db.connect();
      }

      // Test with a simple query
      const result = await this.db.executeQuery('SELECT 1 as test_connection');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              connected: true,
              message: 'Database connection is healthy',
              testResult: result.recordset[0]
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              connected: false,
              message: 'Database connection failed',
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ]
      };
    }
  }
}