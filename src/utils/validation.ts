export class SQLValidator {
  private static readonly DANGEROUS_KEYWORDS = [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE',
    'EXEC', 'EXECUTE', 'SP_', 'XP_', 'SHUTDOWN', 'KILL'
  ];

//   private static readonly ALLOWED_READ_KEYWORDS = [
//     'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
//     'GROUP', 'ORDER', 'HAVING', 'UNION', 'WITH', 'AS', 'DISTINCT',
//     'TOP', 'OFFSET', 'FETCH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
//   ];

  /**
   * Validates if a SQL query is safe for read-only operations
   */
  public static isReadOnlyQuery(query: string): boolean {
    const normalizedQuery = query.trim().toUpperCase();
    
    // Check for dangerous keywords
    for (const keyword of this.DANGEROUS_KEYWORDS) {
      if (normalizedQuery.includes(keyword)) {
        return false;
      }
    }

    // Must start with SELECT or WITH (for CTEs)
    return normalizedQuery.startsWith('SELECT') || normalizedQuery.startsWith('WITH');
  }

  /**
   * Validates if a stored procedure name is safe to execute
   */
  public static isValidProcedureName(procedureName: string): boolean {
    // Basic validation: alphanumeric, underscore, dot (for schema.procedure)
    const regex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/;
    return regex.test(procedureName);
  }

  /**
   * Sanitizes table/column names to prevent SQL injection
   */
  public static sanitizeIdentifier(identifier: string): string {
    // Remove or escape dangerous characters
    return identifier.replace(/[^a-zA-Z0-9_\.]/g, '').substring(0, 128);
  }

  /**
   * Validates parameter values
   */
  public static validateParameter(value: any, dataType: string): boolean {
    if (value === null || value === undefined) {
      return true; // Allow NULL values
    }

    switch (dataType.toLowerCase()) {
      case 'int':
      case 'bigint':
      case 'smallint':
      case 'tinyint':
        return Number.isInteger(Number(value));
      
      case 'decimal':
      case 'numeric':
      case 'float':
      case 'real':
      case 'money':
      case 'smallmoney':
        return !isNaN(Number(value));
      
      case 'varchar':
      case 'nvarchar':
      case 'char':
      case 'nchar':
      case 'text':
      case 'ntext':
        return typeof value === 'string';
      
      case 'datetime':
      case 'datetime2':
      case 'smalldatetime':
      case 'date':
      case 'time':
        return !isNaN(Date.parse(value));
      
      case 'bit':
        return typeof value === 'boolean' || value === 0 || value === 1;
      
      default:
        return true; // Allow unknown types
    }
  }

  /**
   * Checks if a query has potential SQL injection patterns
   */
  public static hasSQLInjectionPatterns(query: string): boolean {
    const suspiciousPatterns = [
      /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE)/i,
      /UNION\s+SELECT/i,
      /--/,
      /\/\*/,
      /\*\//,
      /xp_/i,
      /sp_/i,
      /EXEC\s*\(/i,
      /EXECUTE\s*\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Validates query length to prevent DoS attacks
   */
  public static isValidQueryLength(query: string, maxLength: number = 10000): boolean {
    return query.length <= maxLength;
  }

  /**
   * Comprehensive query validation
   */
  public static validateQuery(query: string, allowWriteOperations: boolean = false): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check query length
    if (!this.isValidQueryLength(query)) {
      errors.push('Query exceeds maximum allowed length');
    }

    // Check for SQL injection patterns
    if (this.hasSQLInjectionPatterns(query)) {
      errors.push('Query contains potentially dangerous patterns');
    }

    // Check if read-only when required
    if (!allowWriteOperations && !this.isReadOnlyQuery(query)) {
      errors.push('Only read-only queries are allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}