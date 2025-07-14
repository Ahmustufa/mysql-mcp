import { DatabaseConnection } from './connection';
import { 
  TableSchema, 
  ColumnInfo, 
  ForeignKeyInfo, 
  IndexInfo, 
  DatabaseMetadata,
  ViewInfo,
  ProcedureInfo,
  FunctionInfo,
  ParameterInfo
} from '../mcp/types';

export class SchemaAnalyzer {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  public async getTableSchema(tableName: string, schemaName: string = 'dbo'): Promise<TableSchema | null> {
    try {
      const [columns, primaryKeys, foreignKeys, indexes] = await Promise.all([
        this.getTableColumns(tableName, schemaName),
        this.getPrimaryKeys(tableName, schemaName),
        this.getForeignKeys(tableName, schemaName),
        this.getIndexes(tableName, schemaName)
      ]);

      return {
        tableName,
        schema: schemaName,
        columns,
        primaryKeys,
        foreignKeys,
        indexes
      };
    } catch (error) {
      console.error(`Error getting schema for table ${schemaName}.${tableName}:`, error);
      return null;
    }
  }

  public async getAllTables(): Promise<string[]> {
    const query = `
      SELECT DISTINCT 
        SCHEMA_NAME(schema_id) + '.' + name as full_name
      FROM sys.tables
      ORDER BY full_name
    `;
    
    const result = await this.db.executeQuery(query);
    return result.recordset.map(row => row.full_name);
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    const [tables, views, procedures, functions] = await Promise.all([
      this.getAllTableSchemas(),
      this.getAllViews(),
      this.getAllProcedures(),
      this.getAllFunctions()
    ]);

    return {
      tables,
      views,
      procedures,
      functions
    };
  }

  private async getAllTableSchemas(): Promise<TableSchema[]> {
    const tableNames = await this.getAllTables();
    const schemas: TableSchema[] = [];

    for (const fullName of tableNames) {
      const [schema, table] = fullName.split('.');
      const tableSchema = await this.getTableSchema(table, schema);
      if (tableSchema) {
        schemas.push(tableSchema);
      }
    }

    return schemas;
  }

  private async getTableColumns(tableName: string, schemaName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.ORDINAL_POSITION,
        CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_IDENTITY,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN sys.identity_columns ic ON ic.object_id = OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME)
        AND ic.name = c.COLUMN_NAME
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA AND pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_NAME = @tableName AND c.TABLE_SCHEMA = @schemaName
      ORDER BY c.ORDINAL_POSITION
    `;

    const result = await this.db.executeQuery(query, { tableName, schemaName });
    
    return result.recordset.map(row => ({
      columnName: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      isNullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      isIdentity: row.IS_IDENTITY === 1,
      isPrimaryKey: row.IS_PRIMARY_KEY === 1,
      ordinalPosition: row.ORDINAL_POSITION
    }));
  }

  private async getPrimaryKeys(tableName: string, schemaName: string): Promise<string[]> {
    const query = `
      SELECT ku.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        AND tc.TABLE_NAME = @tableName
        AND tc.TABLE_SCHEMA = @schemaName
      ORDER BY ku.ORDINAL_POSITION
    `;

    const result = await this.db.executeQuery(query, { tableName, schemaName });
    return result.recordset.map(row => row.COLUMN_NAME);
  }

  private async getForeignKeys(tableName: string, schemaName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT 
        fk.name as CONSTRAINT_NAME,
        c1.name as COLUMN_NAME,
        t2.name as REFERENCED_TABLE,
        c2.name as REFERENCED_COLUMN,
        s2.name as REFERENCED_SCHEMA
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
      JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
      JOIN sys.tables t1 ON fk.parent_object_id = t1.object_id
      JOIN sys.tables t2 ON fk.referenced_object_id = t2.object_id
      JOIN sys.schemas s1 ON t1.schema_id = s1.schema_id
      JOIN sys.schemas s2 ON t2.schema_id = s2.schema_id
      WHERE t1.name = @tableName AND s1.name = @schemaName
    `;

    const result = await this.db.executeQuery(query, { tableName, schemaName });
    
    return result.recordset.map(row => ({
      constraintName: row.CONSTRAINT_NAME,
      columnName: row.COLUMN_NAME,
      referencedTable: row.REFERENCED_TABLE,
      referencedColumn: row.REFERENCED_COLUMN,
      referencedSchema: row.REFERENCED_SCHEMA
    }));
  }

  private async getIndexes(tableName: string, schemaName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT 
        i.name as INDEX_NAME,
        c.name as COLUMN_NAME,
        i.is_unique as IS_UNIQUE,
        i.is_primary_key as IS_PRIMARY_KEY,
        i.type_desc as INDEX_TYPE
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = @tableName AND s.name = @schemaName
      ORDER BY i.name, ic.key_ordinal
    `;

    const result = await this.db.executeQuery(query, { tableName, schemaName });
    
    return result.recordset.map(row => ({
      indexName: row.INDEX_NAME,
      columnName: row.COLUMN_NAME,
      isUnique: row.IS_UNIQUE,
      isPrimaryKey: row.IS_PRIMARY_KEY,
      indexType: row.INDEX_TYPE
    }));
  }

  private async getAllViews(): Promise<ViewInfo[]> {
    const query = `
      SELECT 
        v.TABLE_SCHEMA,
        v.TABLE_NAME,
        v.VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS v
      ORDER BY v.TABLE_SCHEMA, v.TABLE_NAME
    `;

    const result = await this.db.executeQuery(query);
    const views: ViewInfo[] = [];

    for (const row of result.recordset) {
      const columns = await this.getViewColumns(row.TABLE_NAME, row.TABLE_SCHEMA);
      views.push({
        viewName: row.TABLE_NAME,
        schema: row.TABLE_SCHEMA,
        definition: row.VIEW_DEFINITION,
        columns
      });
    }

    return views;
  }

  private async getViewColumns(viewName: string, schemaName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @viewName AND c.TABLE_SCHEMA = @schemaName
      ORDER BY c.ORDINAL_POSITION
    `;

    const result = await this.db.executeQuery(query, { viewName, schemaName });
    
    return result.recordset.map(row => ({
      columnName: row.COLUMN_NAME,
      dataType: row.DATA_TYPE,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      isNullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      isIdentity: false,
      isPrimaryKey: false,
      ordinalPosition: row.ORDINAL_POSITION
    }));
  }

  private async getAllProcedures(): Promise<ProcedureInfo[]> {
    const query = `
      SELECT 
        r.ROUTINE_SCHEMA,
        r.ROUTINE_NAME,
        r.ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES r
      WHERE r.ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY r.ROUTINE_SCHEMA, r.ROUTINE_NAME
    `;

    const result = await this.db.executeQuery(query);
    const procedures: ProcedureInfo[] = [];

    for (const row of result.recordset) {
      const parameters = await this.getRoutineParameters(row.ROUTINE_NAME, row.ROUTINE_SCHEMA);
      procedures.push({
        procedureName: row.ROUTINE_NAME,
        schema: row.ROUTINE_SCHEMA,
        parameters,
        definition: row.ROUTINE_DEFINITION
      });
    }

    return procedures;
  }

  private async getAllFunctions(): Promise<FunctionInfo[]> {
    const query = `
      SELECT 
        r.ROUTINE_SCHEMA,
        r.ROUTINE_NAME,
        r.ROUTINE_DEFINITION,
        r.DATA_TYPE as RETURN_TYPE
      FROM INFORMATION_SCHEMA.ROUTINES r
      WHERE r.ROUTINE_TYPE = 'FUNCTION'
      ORDER BY r.ROUTINE_SCHEMA, r.ROUTINE_NAME
    `;

    const result = await this.db.executeQuery(query);
    const functions: FunctionInfo[] = [];

    for (const row of result.recordset) {
      const parameters = await this.getRoutineParameters(row.ROUTINE_NAME, row.ROUTINE_SCHEMA);
      functions.push({
        functionName: row.ROUTINE_NAME,
        schema: row.ROUTINE_SCHEMA,
        parameters,
        returnType: row.RETURN_TYPE || 'void',
        definition: row.ROUTINE_DEFINITION
      });
    }

    return functions;
  }

  private async getRoutineParameters(routineName: string, schemaName: string): Promise<ParameterInfo[]> {
    const query = `
      SELECT 
        p.PARAMETER_NAME,
        p.DATA_TYPE,
        p.CHARACTER_MAXIMUM_LENGTH,
        p.PARAMETER_MODE,
        p.IS_RESULT,
        p.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.PARAMETERS p
      WHERE p.SPECIFIC_NAME = @routineName AND p.SPECIFIC_SCHEMA = @schemaName
      ORDER BY p.ORDINAL_POSITION
    `;

    const result = await this.db.executeQuery(query, { routineName, schemaName });
    
    return result.recordset.map(row => ({
      parameterName: row.PARAMETER_NAME,
      dataType: row.DATA_TYPE,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      isOutput: row.PARAMETER_MODE === 'OUT' || row.PARAMETER_MODE === 'INOUT',
      hasDefault: false, // SQL Server doesn't expose this easily
      ordinalPosition: row.ORDINAL_POSITION
    }));
  }
}