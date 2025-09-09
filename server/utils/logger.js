const fs = require('fs');
const path = require('path');

/**
 * Simple file logger utility
 */
class Logger {
  constructor() {
    this.logDir = '/app/logs';
    this.appStream = null;
    this.errorStream = null;
    this.debugStream = null;
    this.initialized = false;
    
    // Initialize streams lazily to avoid startup failures
    this.initializeStreams();
  }

  initializeStreams() {
    try {
      this.ensureLogDirectory();
      this.setupStreams();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize file logging, falling back to console only:', error.message);
      this.initialized = false;
    }
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  setupStreams() {
    // Create write streams for different log levels
    this.appStream = fs.createWriteStream(path.join(this.logDir, 'app.log'), { flags: 'a' });
    this.errorStream = fs.createWriteStream(path.join(this.logDir, 'error.log'), { flags: 'a' });
    this.debugStream = fs.createWriteStream(path.join(this.logDir, 'debug.log'), { flags: 'a' });
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}\n`;
  }

  log(level, message, ...args) {
    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // Write to file if streams are available
    if (this.initialized) {
      try {
        if (level === 'ERROR' && this.errorStream) {
          this.errorStream.write(formattedMessage);
        } else if (level === 'DEBUG' && this.debugStream) {
          this.debugStream.write(formattedMessage);
        } else if (this.appStream) {
          this.appStream.write(formattedMessage);
        }
      } catch (error) {
        // If file writing fails, just continue with console logging
        console.error('File logging failed:', error.message);
      }
    }
    
    // Always write to console for Docker logs
    if (level === 'ERROR') {
      console.error(formattedMessage.trim());
    } else {
      console.log(formattedMessage.trim());
    }
  }

  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }

  // Graceful shutdown
  close() {
    if (this.initialized) {
      try {
        if (this.appStream) this.appStream.end();
        if (this.errorStream) this.errorStream.end();
        if (this.debugStream) this.debugStream.end();
      } catch (error) {
        console.error('Error closing log streams:', error.message);
      }
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.close();
});

process.on('SIGTERM', () => {
  logger.close();
});

module.exports = logger;
