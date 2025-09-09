const fs = require('fs');
const path = require('path');

/**
 * Simple file logger utility
 */
class Logger {
  constructor() {
    this.logDir = '/app/logs';
    this.ensureLogDirectory();
    this.setupStreams();
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
    
    // Write to appropriate file
    if (level === 'ERROR') {
      this.errorStream.write(formattedMessage);
    } else if (level === 'DEBUG') {
      this.debugStream.write(formattedMessage);
    } else {
      this.appStream.write(formattedMessage);
    }
    
    // Also write to console for Docker logs
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
    this.appStream.end();
    this.errorStream.end();
    this.debugStream.end();
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
