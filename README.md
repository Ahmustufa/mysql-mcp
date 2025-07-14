# MSSQL MCP Server

A Model Context Protocol (MCP) server for Microsoft SQL Server database interactions. This server allows LLMs to understand database schemas and execute safe SQL queries.

## Features

- **Schema Analysis**: Comprehensive database schema exploration including tables, views, procedures, and functions
- **Safe Query Execution**: Built-in SQL injection protection and read-only query validation
- **Stored Procedure Support**: Execute stored procedures with parameter validation
- **Database Metadata**: Get detailed information about database structure
- **Connection Pooling**: Efficient connection management with configurable pool settings
- **TypeScript Support**: Full TypeScript implementation with type safety

## Installation

```bash
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure your database connection in `.env`:
```bash
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Available Tools

### 1. execute_query
Execute SQL queries with safety validation.

**Parameters:**
- `query` (string): SQL query to execute
- `parameters` (object, optional): Query parameters
- `allow_write` (boolean, optional): Allow write operations (default: false)

**Example:**
```json
{
  "query": "SELECT * FROM Users WHERE id = @userId",
  "parameters": {
    "userId": 123
  }
}
```

### 2. execute_procedure
Execute stored procedures with parameter validation.

**Parameters:**
- `procedure_name` (string): Name of the stored procedure
- `parameters` (object, optional): Procedure parameters

**Example:**
```json
{
  "procedure_name": "GetUserById",
  "parameters": {
    "UserId": 123
  }
}
```

### 3. get_schema
Get detailed schema information for a specific table.

**Parameters:**
- `table_name` (string): Name of the table
- `schema_name` (string, optional): Schema name (default: 'dbo')

**Example:**
```json
{
  "table_name": "Users",
  "schema_name": "dbo"
}
```

### 4. list_tables
List all tables in the database.

**Parameters:** None

### 5. get_database_metadata
Get comprehensive database metadata.

**Parameters:**
- `include_definitions` (boolean, optional): Include procedure/function definitions (default: false)

### 6. validate_query
Validate SQL queries for safety and syntax.

**Parameters:**
- `query` (string): SQL query to validate
- `allow_write` (boolean, optional): Allow write operations in validation (default: false)

## Security Features

- **SQL Injection Protection**: Advanced pattern detection and parameter validation
- **Read-Only Mode**: Queries are read-only by default
- **Parameter Sanitization**: All parameters are validated and sanitized
- **Query Length Limits**: Protection against DoS attacks
- **Stored Procedure Validation**: Safe execution of stored procedures

## Database Schema Information

The server provides detailed schema information including:

- **Tables**: Columns, data types, constraints, indexes
- **Views**: Structure and definitions
- **Stored Procedures**: Parameters and signatures
- **Functions**: Parameters and return types
- **Primary Keys**: Identification of primary key columns
- **Foreign Keys**: Relationship information
- **Indexes**: Index information and types

## Error Handling

The server includes comprehensive error handling:

- Database connection errors
- Query validation errors
- SQL execution errors
- Parameter validation errors
- Graceful shutdown handling

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_SERVER` | Database server address | Required |
| `DB_PORT` | Database port | 1433 |
| `DB_DATABASE` | Database name | Required |
| `DB_USER` | Database username | Required |
| `DB_PASSWORD` | Database password | Required |
| `DB_ENCRYPT` | Enable encryption | true |
| `DB_TRUST_SERVER_CERTIFICATE` | Trust server certificate | true |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | 30000 |
| `DB_REQUEST_TIMEOUT` | Request timeout (ms) | 30000 |
| `DB_POOL_MIN` | Minimum pool connections | 0 |
| `DB_POOL_MAX` | Maximum pool connections | 10 |

## Development

### Project Structure
```
mssql-mcp/
├── src/
│   ├── db/
│   │   ├── connection.ts      # Database connection management
│   │   └── schema.ts          # Schema analysis utilities
│   ├── mcp/
│   │   ├── handlers.ts        # MCP request handlers
│   │   ├── server.ts          # MCP server implementation
│   │   └── types.ts           # Type definitions
│   ├── utils/
│   │   └── validation.ts      # SQL validation utilities
│   └── index.ts               # Main entry point
├── build/                     # Compiled TypeScript output
├── .env                       # Environment configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Building
```bash
npm run build
```

### Watching for Changes
```bash
npm run watch
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please open an issue on the GitHub repository.