const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

class BusinessHoursCalculator {
  constructor() {
    this.timezone = 'Europe/Vienna';
    this.businessStartHour = 9; // 09:00
    this.businessEndHour = 17; // 17:00
    this.businessDays = [1, 2, 3, 4, 5]; // Monday to Friday (1-5)
  }

  /**
   * Calculate business hours between two timestamps
   * @param {Date|string} startTime - Start time (UTC)
   * @param {Date|string} endTime - End time (UTC)
   * @returns {number} Business hours in seconds
   */
  calculateBusinessHours(startTime, endTime) {
    const start = dayjs(startTime).utc();
    const end = dayjs(endTime).utc();

    if (start.isAfter(end)) {
      return 0;
    }

    let totalBusinessSeconds = 0;
    let current = start.tz(this.timezone);

    // Iterate through each day in the range
    while (current.isBefore(end.tz(this.timezone), 'day') || current.isSame(end.tz(this.timezone), 'day')) {
      const dayOfWeek = current.day();
      
      // Skip weekends
      if (!this.businessDays.includes(dayOfWeek)) {
        current = current.add(1, 'day').startOf('day');
        continue;
      }

      // Calculate business hours for this day
      const dayStart = current.startOf('day').add(this.businessStartHour, 'hour');
      const dayEnd = current.startOf('day').add(this.businessEndHour, 'hour');
      
      // Determine the actual start and end times for this day
      const segmentStart = current.isAfter(dayStart) ? current : dayStart;
      const segmentEnd = end.tz(this.timezone).isBefore(dayEnd) ? end.tz(this.timezone) : dayEnd;
      
      // Only count if the segment is within business hours
      if (segmentStart.isBefore(dayEnd) && segmentEnd.isAfter(dayStart)) {
        const businessSeconds = Math.max(0, segmentEnd.diff(segmentStart, 'second'));
        totalBusinessSeconds += businessSeconds;
      }

      current = current.add(1, 'day').startOf('day');
    }

    return totalBusinessSeconds;
  }

  /**
   * Calculate wall hours between two timestamps
   * @param {Date|string} startTime - Start time (UTC)
   * @param {Date|string} endTime - End time (UTC)
   * @returns {number} Wall hours in seconds
   */
  calculateWallHours(startTime, endTime) {
    const start = dayjs(startTime).utc();
    const end = dayjs(endTime).utc();

    if (start.isAfter(end)) {
      return 0;
    }

    return end.diff(start, 'second');
  }

  /**
   * Check if a timestamp is within business hours
   * @param {Date|string} timestamp - Timestamp to check (UTC)
   * @returns {boolean} True if within business hours
   */
  isBusinessHours(timestamp) {
    const time = dayjs(timestamp).utc().tz(this.timezone);
    const dayOfWeek = time.day();
    
    // Check if it's a business day
    if (!this.businessDays.includes(dayOfWeek)) {
      return false;
    }

    // Check if it's within business hours
    const hour = time.hour();
    return hour >= this.businessStartHour && hour < this.businessEndHour;
  }

  /**
   * Get the next business day start
   * @param {Date|string} timestamp - Reference timestamp (UTC)
   * @returns {dayjs.Dayjs} Next business day start in Vienna timezone
   */
  getNextBusinessDayStart(timestamp) {
    let current = dayjs(timestamp).utc().tz(this.timezone).startOf('day');
    
    do {
      current = current.add(1, 'day');
    } while (!this.businessDays.includes(current.day()));
    
    return current.add(this.businessStartHour, 'hour');
  }

  /**
   * Get the previous business day end
   * @param {Date|string} timestamp - Reference timestamp (UTC)
   * @returns {dayjs.Dayjs} Previous business day end in Vienna timezone
   */
  getPreviousBusinessDayEnd(timestamp) {
    let current = dayjs(timestamp).utc().tz(this.timezone).startOf('day');
    
    do {
      current = current.subtract(1, 'day');
    } while (!this.businessDays.includes(current.day()));
    
    return current.add(this.businessEndHour, 'hour');
  }

  /**
   * Format seconds as HH:MM:SS
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted time string
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format seconds as HH:MM
   * @param {number} seconds - Seconds to format
   * @returns {string} Formatted time string
   */
  formatDurationShort(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Get business hours configuration
   * @returns {object} Configuration object
   */
  getConfig() {
    return {
      timezone: this.timezone,
      businessStartHour: this.businessStartHour,
      businessEndHour: this.businessEndHour,
      businessDays: this.businessDays,
      businessDaysNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };
  }
}

module.exports = BusinessHoursCalculator;
