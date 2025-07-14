import dotenv from 'dotenv';
import { MCPServer } from './mcp/server.js';
import { DatabaseConfig } from './mcp/types.js';

// Load environment variables
dotenv.config();

function loadDatabaseConfig(): DatabaseConfig {
  const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    server: process.env.DB_SERVER!,
    port: parseInt(process.env.DB_PORT || '1433'),
    database: process.env.DB_DATABASE!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '0'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
    },
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000'),
  };
}

async function main(): Promise<void> {
  try {
    const config = loadDatabaseConfig();
    const server = new MCPServer(config);
    
    console.log('Starting MSSQL MCP Server...');
    console.log(`Connecting to: ${config.server}:${config.port}/${config.database}`);
    
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});