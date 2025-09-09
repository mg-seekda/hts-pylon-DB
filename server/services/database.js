const { Pool } = require('pg');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      this.pool = new Pool({
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('✅ PostgreSQL connected successfully');
      
      // Run migrations
      await this.runMigrations();
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      this.isConnected = false;
    }
  }

  async initWithoutMigrations() {
    try {
      this.pool = new Pool({
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      console.log('✅ PostgreSQL connected successfully');
      
      // Skip migrations - they will be handled manually
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      this.isConnected = false;
    }
  }

  async runMigrations() {
    if (!this.isConnected) return;

    try {
      const client = await this.pool.connect();
      
      // Create closed_by_assignee table
      // NOTE: This table is ONLY updated by AssigneeSyncService for data consistency
      // All other services (webhooks, daily ingestion, backfill) are disabled for this table
      await client.query(`
        CREATE TABLE IF NOT EXISTS closed_by_assignee (
          bucket_start timestamptz NOT NULL,
          bucket text NOT NULL CHECK (bucket IN ('day','week')),
          assignee_id text NOT NULL,
          assignee_name text NOT NULL,
          count integer NOT NULL,
          PRIMARY KEY (bucket_start, bucket, assignee_id)
        );
      `);

      // Create assignees table
      await client.query(`
        CREATE TABLE IF NOT EXISTS assignees (
          assignee_id text PRIMARY KEY,
          assignee_name text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create ticket_status_events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_status_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          event_id text UNIQUE NOT NULL,
          ticket_id text NOT NULL,
          status text NOT NULL,
          assignee_id text,
          assignee_name text,
          closed_at_utc timestamptz,
          occurred_at_utc timestamptz NOT NULL,
          received_at_utc timestamptz NOT NULL DEFAULT now(),
          raw jsonb NOT NULL
        );
      `);

      // Add new columns to existing ticket_status_events table (for tables created before these columns were added)
      await client.query(`
        ALTER TABLE ticket_status_events 
        ADD COLUMN IF NOT EXISTS assignee_id text,
        ADD COLUMN IF NOT EXISTS assignee_name text,
        ADD COLUMN IF NOT EXISTS closed_at_utc timestamptz
      `);

      // Create ticket_status_segments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_status_segments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id text NOT NULL,
          status text NOT NULL,
          entered_at_utc timestamptz NOT NULL,
          left_at_utc timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create ticket_status_agg_daily table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_status_agg_daily (
          bucket_date date NOT NULL,
          status text NOT NULL,
          avg_duration_wall_seconds bigint NOT NULL,
          avg_duration_business_seconds bigint NOT NULL,
          count_segments integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (bucket_date, status)
        );
      `);

      // Create ticket_status_agg_weekly table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_status_agg_weekly (
          bucket_iso_year integer NOT NULL,
          bucket_iso_week integer NOT NULL,
          status text NOT NULL,
          avg_duration_wall_seconds bigint NOT NULL,
          avg_duration_business_seconds bigint NOT NULL,
          count_segments integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (bucket_iso_year, bucket_iso_week, status)
        );
      `);

      // Create indexes for existing tables
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cba_bucket ON closed_by_assignee (bucket, bucket_start);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cba_assignee ON closed_by_assignee (assignee_id);
      `);

      // Create indexes for ticket lifecycle tables
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_ticket_id ON ticket_status_events (ticket_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_occurred_at ON ticket_status_events (occurred_at_utc);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_status_occurred ON ticket_status_events (status, occurred_at_utc);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_event_id ON ticket_status_events (event_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_assignee_id ON ticket_status_events (assignee_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_status_assignee ON ticket_status_events (status, assignee_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tse_closed_at ON ticket_status_events (closed_at_utc);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tss_ticket_entered ON ticket_status_segments (ticket_id, entered_at_utc);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tss_status_entered ON ticket_status_segments (status, entered_at_utc);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tss_left_at ON ticket_status_segments (left_at_utc) WHERE left_at_utc IS NOT NULL;
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tsad_bucket_date ON ticket_status_agg_daily (bucket_date);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tsad_status ON ticket_status_agg_daily (status);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tsaw_year_week ON ticket_status_agg_weekly (bucket_iso_year, bucket_iso_week);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tsaw_status ON ticket_status_agg_weekly (status);
      `);

      client.release();
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Helper method to convert local Vienna time to UTC for database queries
  toViennaTime(date) {
    return dayjs(date).tz('Europe/Vienna');
  }

  // Helper method to convert Vienna time to UTC for database storage
  toUTC(date) {
    return dayjs.tz(date, 'Europe/Vienna').utc();
  }

  // Helper method to get start of day in Vienna timezone, converted to UTC
  getStartOfDayUTC(date) {
    return this.toViennaTime(date).startOf('day').utc();
  }

  // Helper method to get end of day in Vienna timezone, converted to UTC
  getEndOfDayUTC(date) {
    return this.toViennaTime(date).endOf('day').utc();
  }

  // Helper method to get start of week in Vienna timezone, converted to UTC
  getStartOfWeekUTC(date) {
    return this.toViennaTime(date).startOf('week').utc();
  }

  // Helper method to get end of week in Vienna timezone, converted to UTC
  getEndOfWeekUTC(date) {
    return this.toViennaTime(date).endOf('week').utc();
  }

  async close() {
    if (this.pool && this.isConnected) {
      try {
        await this.pool.end();
        this.isConnected = false;
        console.log('✅ PostgreSQL connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing database connection:', error.message);
      }
    }
  }
}

module.exports = new DatabaseService();
