const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const VIENNA_TIMEZONE = 'Europe/Vienna';

class TimezoneUtils {
  // Convert any date to Vienna timezone
  static toVienna(date) {
    return dayjs(date).tz(VIENNA_TIMEZONE);
  }

  // Convert Vienna time to UTC for database storage
  static toUTC(date) {
    return dayjs.tz(date, VIENNA_TIMEZONE).utc();
  }

  // Get start of day in Vienna timezone, converted to UTC
  static getStartOfDayUTC(date) {
    return this.toVienna(date).startOf('day').utc();
  }

  // Get end of day in Vienna timezone, converted to UTC
  static getEndOfDayUTC(date) {
    return this.toVienna(date).endOf('day').utc();
  }

  // Get start of week (Monday) in Vienna timezone, converted to UTC
  static getStartOfWeekUTC(date) {
    return this.toVienna(date).startOf('week').utc();
  }

  // Get end of week (Sunday) in Vienna timezone, converted to UTC
  static getEndOfWeekUTC(date) {
    return this.toVienna(date).endOf('week').utc();
  }

  // Get date presets for the UI
  static getDatePresets() {
    const now = this.toVienna();
    
    return {
      thisWeek: {
        label: 'This Week',
        from: this.getStartOfWeekUTC(now).format('YYYY-MM-DD'),
        to: this.getEndOfWeekUTC(now).format('YYYY-MM-DD')
      },
      lastWeek: {
        label: 'Last Week',
        from: this.getStartOfWeekUTC(now.subtract(1, 'week')).format('YYYY-MM-DD'),
        to: this.getEndOfWeekUTC(now.subtract(1, 'week')).format('YYYY-MM-DD')
      },
      thisMonth: {
        label: 'This Month',
        from: this.toVienna(now).startOf('month').format('YYYY-MM-DD'),
        to: this.toVienna(now).endOf('month').format('YYYY-MM-DD')
      },
      lastMonth: {
        label: 'Last Month',
        from: this.toVienna(now).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        to: this.toVienna(now).subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      }
    };
  }

  // Validate and clamp date range
  static validateDateRange(from, to, allowFutureDates = false) {
    const fromDate = this.toVienna(from);
    const toDate = this.toVienna(to);
    const now = this.toVienna();

    // Ensure to >= from
    if (toDate.isBefore(fromDate)) {
      throw new Error('End date must be after start date');
    }

    // Only clamp to today if future dates are not allowed (for real-time data)
    if (allowFutureDates) {
      return {
        from: fromDate.format('YYYY-MM-DD'),
        to: toDate.format('YYYY-MM-DD')
      };
    } else {
      // Clamp to not exceed today
      const clampedTo = toDate.isAfter(now) ? now : toDate;
      const clampedFrom = fromDate.isAfter(clampedTo) ? clampedTo : fromDate;

      return {
        from: clampedFrom.format('YYYY-MM-DD'),
        to: clampedTo.format('YYYY-MM-DD')
      };
    }
  }

  // Get yesterday in Vienna timezone (for daily ingestion)
  static getYesterday() {
    return this.toVienna().subtract(1, 'day');
  }

  // Format date for display in Vienna timezone
  static formatForDisplay(date, format = 'YYYY-MM-DD') {
    return this.toVienna(date).format(format);
  }

  // Check if a date is today in Vienna timezone
  static isToday(date) {
    return this.toVienna(date).isSame(this.toVienna(), 'day');
  }

  // Check if a date is yesterday in Vienna timezone
  static isYesterday(date) {
    return this.toVienna(date).isSame(this.getYesterday(), 'day');
  }
}

module.exports = TimezoneUtils;
