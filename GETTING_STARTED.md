# Quick Start Guide

This guide will help you get the MySQL MCP Server running quickly in different environments.

## 🚀 Quick Start with Docker Compose (Recommended)

This is the fastest way to get started with a complete MySQL + MCP setup:

```bash
# 1. Clone the repository
git clone https://github.com/Ahmustufa/mysql-mcp.git
cd mysql-mcp

# 2. Start everything with Docker Compose
docker-compose up -d

# 3. Wait for services to be ready (about 30-60 seconds)
docker-compose logs -f mysql-mcp

# 4. Test the connection
docker-compose exec mysql-mcp npm run test-connection
```

This sets up:

- MySQL 8.0 database with sample data
- MySQL MCP Server
- PHPMyAdmin (accessible at http://localhost:8080)

## 🔧 Local Development Setup

If you want to develop or run locally:

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Update .env with your MySQL connection details
# Edit .env file with your database credentials

# 4. Start development server
npm run dev
```

## 🌐 Using with Existing MySQL Database

To connect to your existing MySQL database:

```bash
# 1. Create .env file
cat > .env << EOF
DB_SERVER=your-mysql-host
DB_DATABASE=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
DB_PORT=3306
DB_SSL=false
EOF

# 2. Build and run
npm run build
npm start
```

## ☁️ AWS RDS Setup

For AWS RDS MySQL:

```bash
# 1. Create .env file for RDS
cat > .env << EOF
DB_SERVER=your-rds-endpoint.region.rds.amazonaws.com
DB_DATABASE=your_database
DB_USER=admin
DB_PASSWORD=your_secure_password
DB_PORT=3306
# DB_SSL automatically uses 'Amazon RDS' SSL
EOF

# 2. Build and run
npm run build
npm start
```

## 🐳 Docker Commands Reference

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Start with compose
npm run docker:compose

# View logs
npm run docker:logs

# Stop services
npm run docker:stop

# Clean up everything
npm run docker:clean
```

## 🧪 Testing the Setup

Once running, you can test the MCP tools:

### 1. List Tables

```bash
# This will show all tables in your database
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_tables"}'
```

### 2. Describe Table

```bash
# Get schema information for a specific table
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "describe_table", "table_name": "users"}'
```

### 3. Execute Query

```bash
# Run a SQL query
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "execute_query", "query": "SELECT COUNT(*) as total_users FROM users"}'
```

## 🔍 Troubleshooting

### MySQL Connection Issues

```bash
# Check if MySQL is running
docker-compose ps

# Check MySQL logs
docker-compose logs mysql

# Test MySQL connection directly
docker-compose exec mysql mysql -u root -p
```

### MCP Server Issues

```bash
# Check MCP server logs
docker-compose logs mysql-mcp

# Restart MCP server only
docker-compose restart mysql-mcp

# Rebuild and restart
docker-compose build mysql-mcp
docker-compose up -d mysql-mcp
```

### Port Conflicts

If ports 3306 or 8080 are already in use:

```yaml
# Edit docker-compose.yml
services:
  mysql:
    ports:
      - "3307:3306" # Change external port

  phpmyadmin:
    ports:
      - "8081:80" # Change external port
```

## 📁 Sample Data

The Docker setup includes sample data with:

- **users**: Sample user accounts
- **posts**: Blog posts with different statuses
- **categories**: Hierarchical categories
- **post_categories**: Many-to-many relationships

Access PHPMyAdmin at http://localhost:8080 to explore the data:

- **Username**: root
- **Password**: rootpassword

## 🔐 Security Notes

For production use:

1. Change default passwords in docker-compose.yml
2. Use environment variables for sensitive data
3. Enable SSL for database connections
4. Restrict network access with proper firewall rules
5. Use strong authentication for database users

## 📚 Next Steps

1. **Explore the API**: Try different MCP tools with your data
2. **Customize**: Modify the MCP tools for your specific needs
3. **Scale**: Deploy multiple instances for high availability
4. **Monitor**: Set up logging and monitoring for production use

For more detailed information, see the main [README.md](README.md).
