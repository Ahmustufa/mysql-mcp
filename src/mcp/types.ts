export interface DatabaseConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
  pool?: {
    min: number;
    max: number;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
}

export interface TableSchema {
  tableName: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  maxLength?: number;
  isNullable: boolean;
  defaultValue?: string;
  isIdentity: boolean;
  isPrimaryKey: boolean;
  ordinalPosition: number;
}

export interface ForeignKeyInfo {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  referencedSchema: string;
}

export interface IndexInfo {
  indexName: string;
  columnName: string;
  isUnique: boolean;
  isPrimaryKey: boolean;
  indexType: string;
}

export interface QueryResult {
  recordset: any[];
  recordsets: any[][];
  output: Record<string, any>;
  rowsAffected: number[];
}

export interface DatabaseMetadata {
  tables: TableSchema[];
  views: ViewInfo[];
  procedures: ProcedureInfo[];
  functions: FunctionInfo[];
}

export interface ViewInfo {
  viewName: string;
  schema: string;
  definition: string;
  columns: ColumnInfo[];
}

export interface ProcedureInfo {
  procedureName: string;
  schema: string;
  parameters: ParameterInfo[];
  definition?: string;
}

export interface FunctionInfo {
  functionName: string;
  schema: string;
  parameters: ParameterInfo[];
  returnType: string;
  definition?: string;
}

export interface ParameterInfo {
  parameterName: string;
  dataType: string;
  maxLength?: number;
  isOutput: boolean;
  hasDefault: boolean;
  ordinalPosition: number;
}