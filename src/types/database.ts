/**
 * Configuration for the database connection pool.
 */
export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
} 