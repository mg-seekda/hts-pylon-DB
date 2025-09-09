const database = require('../server/services/database');

async function createIngestionMetadataTable() {
  try {
    console.log('Creating ingestion_metadata table...');
    
    const query = `
      CREATE TABLE IF NOT EXISTS ingestion_metadata (
        id SERIAL PRIMARY KEY,
        service_name VARCHAR(100) NOT NULL,
        last_run TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(service_name, last_run::date)
      );
      
      CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_service_name 
      ON ingestion_metadata(service_name);
      
      CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_last_run 
      ON ingestion_metadata(last_run DESC);
    `;
    
    await database.query(query);
    console.log('✅ ingestion_metadata table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating ingestion_metadata table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createIngestionMetadataTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createIngestionMetadataTable;
