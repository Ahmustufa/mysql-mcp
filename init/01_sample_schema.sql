-- Sample database initialization script
-- This script creates sample tables and data for testing the MCP server

-- Create sample users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create sample posts table
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Create sample categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id)
);

-- Create post_categories junction table
CREATE TABLE IF NOT EXISTS post_categories (
    post_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO users (username, email, first_name, last_name) VALUES
('john_doe', 'john.doe@example.com', 'John', 'Doe'),
('jane_smith', 'jane.smith@example.com', 'Jane', 'Smith'),
('bob_wilson', 'bob.wilson@example.com', 'Bob', 'Wilson'),
('alice_brown', 'alice.brown@example.com', 'Alice', 'Brown'),
('charlie_davis', 'charlie.davis@example.com', 'Charlie', 'Davis');

INSERT INTO categories (name, description) VALUES
('Technology', 'Articles about technology and programming'),
('Business', 'Business-related content and insights'),
('Lifestyle', 'Life, health, and lifestyle topics'),
('Education', 'Educational content and tutorials');

INSERT INTO categories (name, description, parent_id) VALUES
('Programming', 'Programming tutorials and tips', 1),
('AI/ML', 'Artificial Intelligence and Machine Learning', 1),
('Startups', 'Startup advice and stories', 2),
('Marketing', 'Marketing strategies and tips', 2);

INSERT INTO posts (user_id, title, content, status) VALUES
(1, 'Getting Started with MySQL', 'This is a comprehensive guide to MySQL database basics...', 'published'),
(1, 'Advanced SQL Queries', 'Learn about complex SQL queries and optimization techniques...', 'published'),
(2, 'Building Scalable Web Applications', 'A deep dive into scalable architecture patterns...', 'published'),
(3, 'Introduction to Machine Learning', 'Machine learning fundamentals for beginners...', 'draft'),
(4, 'Effective Project Management', 'Tips and tricks for managing software projects...', 'published'),
(5, 'Database Performance Tuning', 'How to optimize database performance for large datasets...', 'published'),
(2, 'RESTful API Design Best Practices', 'Guidelines for designing robust REST APIs...', 'draft'),
(3, 'Docker Container Optimization', 'Strategies for optimizing Docker containers...', 'published');

INSERT INTO post_categories (post_id, category_id) VALUES
(1, 1), (1, 5),  -- MySQL post: Technology, Programming
(2, 1), (2, 5),  -- SQL post: Technology, Programming
(3, 1), (3, 5),  -- Web apps: Technology, Programming
(4, 1), (4, 6),  -- ML post: Technology, AI/ML
(5, 2), (5, 7),  -- Project mgmt: Business, Startups
(6, 1), (6, 5),  -- DB performance: Technology, Programming
(7, 1), (7, 5),  -- API design: Technology, Programming
(8, 1), (8, 5);  -- Docker: Technology, Programming

-- Create a sample view
CREATE VIEW active_user_posts AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    p.id as post_id,
    p.title,
    p.status,
    p.created_at as post_created_at
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE u.is_active = TRUE
ORDER BY p.created_at DESC;

-- Create a sample stored procedure
DELIMITER //
CREATE PROCEDURE GetUserPostCount(IN user_id INT)
BEGIN
    SELECT 
        u.username,
        u.email,
        COUNT(p.id) as post_count,
        COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_count,
        COUNT(CASE WHEN p.status = 'draft' THEN 1 END) as draft_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.id = user_id
    GROUP BY u.id, u.username, u.email;
END //
DELIMITER ;

-- Grant privileges to the MCP user (if created)
GRANT SELECT, INSERT, UPDATE, DELETE ON testdb.* TO 'mcpuser'@'%';
FLUSH PRIVILEGES;
