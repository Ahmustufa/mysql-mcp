# MySQL MCP Server

A Model Context Protocol (MCP) server for MySQL database interactions. This server allows LLMs to understand database schemas and execute safe SQL queries with built-in security features and scalability support.

> 🚀 **Quick Start**: New to this project? Check out our [Getting Started Guide](GETTING_STARTED.md) for the fastest way to get up and running!

## Features

- **Schema Analysis**: Comprehensive database schema exploration including tables, views, and stored procedures
- **Safe Query Execution**: Built-in SQL injection protection and read-only query validation
- **Connection Pooling**: Efficient connection management with configurable pool settings
- **Docker Support**: Ready-to-deploy Docker container with multi-stage builds
- **TypeScript Support**: Full TypeScript implementation with type safety
- **AWS RDS Compatible**: Optimized for AWS RDS MySQL instances with SSL support
- **Scalable Architecture**: Designed for high-performance database interactions

## Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com/Ahmustufa/mysql-mcp.git
cd mysql-mcp

# Install dependencies
npm install

# Install development dependencies (if not automatically installed)
npm install --save-dev tsx @types/node
```

### Docker Installation

```bash
# Build the Docker image
docker build -t mysql-mcp .

# Or pull from registry (if published)
docker pull ahmustufa/mysql-mcp:latest
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required Database Configuration
DB_SERVER=localhost
DB_DATABASE=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# Optional Configuration
DB_PORT=3306
DB_SSL=false  # Set to 'false' to disable SSL, or leave undefined for AWS RDS SSL

# For AWS RDS MySQL
# DB_SERVER=your-rds-endpoint.region.rds.amazonaws.com
# DB_SSL=Amazon RDS  # Enables SSL for RDS
```

### Docker Environment

For Docker deployments, you can use environment variables or a `.env` file:

```bash
# Docker with environment variables
docker run -e DB_SERVER=localhost \
           -e DB_DATABASE=mydb \
           -e DB_USER=user \
           -e DB_PASSWORD=password \
           mysql-mcp

# Docker with .env file
docker run --env-file .env mysql-mcp
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Docker Usage

```bash
# Basic Docker run
docker run --env-file .env mysql-mcp

# Docker with port mapping (if extending with HTTP endpoints)
docker run -p 3000:3000 --env-file .env mysql-mcp

# Docker Compose (see docker-compose.yml section below)
docker-compose up -d
```

## Available Tools

### 1. execute_query

Execute SQL queries with built-in safety validation.

**Parameters:**

- `query` (string): SQL query to execute

**Safety Features:**

- Blocks destructive operations (DROP, DELETE, TRUNCATE)
- Prevents SQL injection attacks
- Read-focused operations

**Example:**

```json
{
  "query": "SELECT * FROM users WHERE id = 1"
}
```

### 2. list_tables

List all base tables in the current database.

**Parameters:** None

**Returns:** Array of table information including schema, name, and type.

**Example Usage:**

```json
{
  "tool": "list_tables"
}
```

### 3. describe_table

Get detailed schema information for a specific table.

**Parameters:**

- `table_name` (string): Name of the table to describe

**Returns:** Column information including data types, nullability, defaults, and constraints.

**Example:**

```json
{
  "table_name": "users"
}
```

### 4. get_table_data

Retrieve sample data from a table.

**Parameters:**

- `table_name` (string): Name of the table
- `limit` (number, optional): Number of rows to return (1-100, default: 10)

**Example:**

```json
{
  "table_name": "users",
  "limit": 5
}
```

### 5. primary_keys

Get primary key column(s) for a specific table.

**Parameters:**

- `table_name` (string): Name of the table

**Returns:** List of primary key columns for the specified table.

**Example:**

```json
{
  "table_name": "users"
}
```

### 6. search_columns

Find columns whose names match a pattern (case-insensitive).

**Parameters:**

- `like` (string): Pattern to search for in column names

**Returns:** List of matching columns across all tables with their data types.

**Example:**

```json
{
  "like": "email"
}
```

### 7. foreign_keys

List foreign key relationships for a table.

**Parameters:**

- `table_name` (string): Name of the table

**Returns:** Foreign key relationships both referencing and referenced by the table.

**Example:**

```json
{
  "table_name": "posts"
}
```

### 8. introspect_schema

Get a complete schema overview of the database.

**Parameters:** None

**Returns:** Comprehensive JSON map of all tables with their columns, primary keys, and foreign key relationships.

**Example:**

```json
{
  "tool": "introspect_schema"
}
```

## Security Features

- **SQL Injection Protection**: Advanced pattern detection and query validation
- **Read-Only Default**: Destructive operations are blocked by default
- **Connection Pooling**: Secure and efficient database connections
- **SSL Support**: Built-in SSL support for secure database connections
- **Parameter Validation**: All inputs are validated before execution
- **Query Length Limits**: Protection against DoS attacks

## Docker Support

### Basic Docker Commands

```bash
# Build the image
docker build -t mysql-mcp .

# Run with environment variables
docker run --rm \
  -e DB_SERVER=your-mysql-server \
  -e DB_DATABASE=your_database \
  -e DB_USER=your_user \
  -e DB_PASSWORD=your_password \
  mysql-mcp

# Run with .env file
docker run --rm --env-file .env mysql-mcp

# Run with volume mount for configuration
docker run --rm \
  -v $(pwd)/.env:/app/.env \
  mysql-mcp
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  mysql-mcp:
    build: .
    environment:
      - DB_SERVER=mysql
      - DB_DATABASE=testdb
      - DB_USER=root
      - DB_PASSWORD=rootpassword
      - DB_PORT=3306
    depends_on:
      - mysql
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=testdb
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql_data:
```

Run with Docker Compose:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f mysql-mcp

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Scaling with Docker

For high-availability deployments:

```yaml
version: "3.8"

services:
  mysql-mcp:
    build: .
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      - DB_SERVER=mysql-primary
      - DB_DATABASE=proddb
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - mysql-primary

  mysql-primary:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=proddb
    volumes:
      - mysql_primary_data:/var/lib/mysql
    deploy:
      placement:
        constraints: [node.role == manager]

volumes:
  mysql_primary_data:
```

## Error Handling

The server includes comprehensive error handling:

- Database connection errors
- Query validation errors
- SQL execution errors
- Parameter validation errors
- Graceful shutdown handling

## Database Schema Information

The server provides detailed schema information including:

- **Tables**: Columns, data types, constraints, and structure
- **Views**: Available database views and their definitions
- **Data Types**: MySQL-specific data types and constraints
- **Indexes**: Primary keys and index information
- **Character Sets**: UTF-8 and collation support

## Environment Variables

| Variable      | Description                 | Default      | Required |
| ------------- | --------------------------- | ------------ | -------- |
| `DB_SERVER`   | MySQL server hostname or IP | -            | ✅       |
| `DB_DATABASE` | Database name               | -            | ✅       |
| `DB_USER`     | Database username           | -            | ✅       |
| `DB_PASSWORD` | Database password           | -            | ✅       |
| `DB_PORT`     | Database port               | 3306         | ❌       |
| `DB_SSL`      | SSL configuration           | 'Amazon RDS' | ❌       |

### SSL Configuration

- Set `DB_SSL=false` to disable SSL completely
- Leave undefined or set to `'Amazon RDS'` for AWS RDS SSL support
- For custom SSL configurations, modify the connection settings in the code

## AWS RDS Integration

This MCP server is optimized for AWS RDS MySQL instances:

```bash
# AWS RDS Configuration
DB_SERVER=your-rds-instance.region.rds.amazonaws.com
DB_DATABASE=your_database
DB_USER=admin
DB_PASSWORD=your_secure_password
DB_PORT=3306
# DB_SSL is automatically set to 'Amazon RDS' for SSL
```

### RDS Security Groups

Ensure your RDS security group allows connections from your application:

- Port: 3306 (or your custom port)
- Source: Your application's IP range or security group

## Performance and Scalability

### Connection Pooling

The server uses MySQL2's built-in connection pooling:

- Automatic connection management
- Connection reuse for better performance
- Configurable timeout settings (60 seconds default)

### Scaling Strategies

1. **Horizontal Scaling**: Deploy multiple MCP server instances
2. **Database Read Replicas**: Point to MySQL read replicas for read-heavy workloads
3. **Connection Limits**: Monitor and configure MySQL `max_connections`
4. **Resource Monitoring**: Use CloudWatch or similar for RDS monitoring

### Production Optimization

```dockerfile
# Multi-stage build for smaller production images
FROM node:22.20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22.20-alpine as production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY build ./build
CMD ["node", "build/index.js"]
```

## Development

### Project Structure

```
mysql-mcp/
├── src/
│   └── index.ts               # Main entry point with MCP server implementation
├── build/                     # Compiled TypeScript output
├── .env                       # Environment configuration
├── .dockerignore              # Docker ignore file
├── Dockerfile                 # Docker container configuration
├── docker-compose.yml         # Docker Compose setup (create this)
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This documentation
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Watch for changes (compile only)
npm run watch

# Clean build directory
npm run clean
```

### Adding New Tools

To add new MCP tools, register them in `src/index.ts`:

```typescript
server.registerTool(
  "your_tool_name",
  {
    title: "Your Tool Title",
    description: "Description of what your tool does",
    inputSchema: {
      parameter: z.string().min(1),
    },
  },
  async ({ parameter }) => {
    // Your tool implementation
    const result = await performSomeOperation(parameter);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);
```

## Error Handling

The server includes comprehensive error handling:

- **Database Connection Errors**: Automatic retry with exponential backoff
- **Query Validation Errors**: Detailed error messages for invalid queries
- **SQL Execution Errors**: Safe error reporting without exposing sensitive data
- **Parameter Validation**: Type checking and sanitization
- **Graceful Shutdown**: Proper cleanup of database connections

## Troubleshooting

### Common Issues

1. **Connection Refused**

   ```bash
   Error: connect ECONNREFUSED
   ```

   - Check if MySQL server is running
   - Verify DB_SERVER and DB_PORT configuration
   - Check firewall/security group settings

2. **Authentication Failed**

   ```bash
   Error: Access denied for user
   ```

   - Verify DB_USER and DB_PASSWORD
   - Check user permissions in MySQL
   - Ensure user can connect from your host

3. **Database Not Found**

   ```bash
   Error: Unknown database
   ```

   - Verify DB_DATABASE exists
   - Check user has access to the specified database

4. **SSL Connection Issues**
   ```bash
   Error: SSL connection error
   ```
   - For local development: set `DB_SSL=false`
   - For RDS: ensure SSL certificates are properly configured

### Debug Mode

Enable detailed logging by setting NODE_ENV:

```bash
NODE_ENV=development npm run dev
```

## Testing

### Unit Tests

```bash
# Add testing framework
npm install --save-dev jest @types/jest

# Run tests
npm test
```

### Integration Tests

```bash
# Test with actual database
npm run test:integration
```

### Load Testing

```bash
# Test connection pooling and performance
npm run test:load
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes with proper TypeScript types
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Add JSDoc comments for public APIs
- Use semantic commit messages

### Pull Request Process

1. Ensure all tests pass
2. Update the README if needed
3. Add a clear description of changes
4. Reference any related issues

## Changelog

### v1.1.0

- Switched from MSSQL to MySQL support
- Added AWS RDS SSL compatibility
- Improved connection pooling
- Added Docker support with multi-stage builds
- Enhanced security with query validation

### v1.0.0

- Initial release with basic MCP tools
- TypeScript implementation
- Basic Docker support

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:

- **GitHub Issues**: [Open an issue](https://github.com/Ahmustufa/mysql-mcp/issues)
- **Documentation**: Check this README for common solutions
- **Community**: Join discussions in GitHub Discussions

## Related Projects

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MySQL2 Node.js Driver](https://github.com/sidorares/node-mysql2)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)

## Acknowledgments

- Model Context Protocol team for the excellent SDK
- MySQL2 maintainers for the robust database driver
- The open-source community for continuous improvements
