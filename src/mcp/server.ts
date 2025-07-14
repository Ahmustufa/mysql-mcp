import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  
} from '@modelcontextprotocol/sdk/types.js';

import { DatabaseConnection } from '../db/connection.js';
import { MCPHandlers } from './handlers.js';
import { DatabaseConfig } from './types.js';

export class MCPServer {
  private server: Server;
  private handlers: MCPHandlers;
  private db: DatabaseConnection;

  constructor(config: DatabaseConfig) {
    this.db = DatabaseConnection.getInstance(config);
    this.handlers = new MCPHandlers(this.db);
    this.server = new Server(
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

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.handlers.listTools();
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handlers.callTool(request);
    });

    // Handle errors
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.db.connect();
      console.log('Database connected successfully');

      // Start the server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log('MCP Server started successfully');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        await this.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await this.shutdown();
        process.exit(0);
      });

    } catch (error) {
      console.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      console.log('Shutting down MCP server...');
      
      // Close database connection
      await this.db.disconnect();
      
      // Close server
      await this.server.close();
      
      console.log('MCP server shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  public getServer(): Server {
    return this.server;
  }
}