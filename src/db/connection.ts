import * as sql from 'mssql';
import { DatabaseConfig } from '../mcp/types';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: sql.ConnectionPool | null = null;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig) {
    this.config = config;
  }

  public static getInstance(config: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.pool?.connected) {
      return;
    }

    try {
      const sqlConfig: sql.config = {
        server: this.config.server,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        options: this.config.options,
        connectionTimeout: this.config.connectionTimeout || 30000,
        requestTimeout: this.config.requestTimeout || 30000,
        pool: this.config.pool || { min: 0, max: 10 }
      };

      this.pool = new sql.ConnectionPool(sqlConfig);
      await this.pool.connect();
      
      console.log('Connected to SQL Server database');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Disconnected from SQL Server database');
    }
  }

  public async executeQuery(query: string, parameters?: Record<string, any>): Promise<sql.IResult<any>> {
    if (!this.pool?.connected) {
      await this.connect();
    }

    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    try {
      const request = this.pool.request();
      
      // Add parameters if provided
      if (parameters) {
        for (const [key, value] of Object.entries(parameters)) {
          request.input(key, value);
        }
      }

      const result = await request.query(query);
      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  public async executeStoredProcedure(
    procedureName: string, 
    parameters?: Record<string, any>
  ): Promise<sql.IResult<any>> {
    if (!this.pool?.connected) {
      await this.connect();
    }

    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    try {
      const request = this.pool.request();
      
      // Add parameters if provided
      if (parameters) {
        for (const [key, value] of Object.entries(parameters)) {
          request.input(key, value);
        }
      }

      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      console.error('Stored procedure execution failed:', error);
      throw error;
    }
  }

  public getPool(): sql.ConnectionPool | null {
    return this.pool;
  }

  public isConnected(): boolean {
    return this.pool?.connected || false;
  }
}