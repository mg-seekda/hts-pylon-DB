const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

async function setupDatabase() {
  console.log('🗄️  Setting up PostgreSQL database...\n');


  const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: String(process.env.POSTGRES_PASSWORD), // Explicitly convert to string
    database: process.env.POSTGRES_DB,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
  });

  try {
    // Test connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');

    // Create tables
    console.log('\n2. Creating tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS closed_by_assignee (
        bucket_start timestamptz NOT NULL,
        bucket text NOT NULL CHECK (bucket IN ('day','week')),
        assignee_id text NOT NULL,
        assignee_name text NOT NULL,
        count integer NOT NULL,
        PRIMARY KEY (bucket_start, bucket, assignee_id)
      );
    `);
    console.log('✅ Created closed_by_assignee table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignees (
        assignee_id text PRIMARY KEY,
        assignee_name text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('✅ Created assignees table');

    // Create indexes
    console.log('\n3. Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cba_bucket ON closed_by_assignee (bucket, bucket_start);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cba_assignee ON closed_by_assignee (assignee_id);
    `);
    console.log('✅ Created indexes');

    // Test data insertion
    console.log('\n4. Testing data insertion...');
    const testData = {
      bucket_start: new Date().toISOString(),
      bucket: 'day',
      assignee_id: 'test-user-123',
      assignee_name: 'Test User',
      count: 1
    };

    await pool.query(`
      INSERT INTO closed_by_assignee (bucket_start, bucket, assignee_id, assignee_name, count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (bucket_start, bucket, assignee_id)
      DO UPDATE SET 
        assignee_name = EXCLUDED.assignee_name,
        count = EXCLUDED.count
    `, [testData.bucket_start, testData.bucket, testData.assignee_id, testData.assignee_name, testData.count]);

    console.log('✅ Test data inserted successfully');

    // Clean up test data
    await pool.query(`
      DELETE FROM closed_by_assignee WHERE assignee_id = 'test-user-123'
    `);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm run dev (in server directory)');
    console.log('2. Run backfill to import historical data');
    console.log('3. Start the client: npm start (in client directory)');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database exists');
    console.error('3. Environment variables are set correctly');
  } finally {
    await pool.end();
  }
}

// Run the setup
setupDatabase();
