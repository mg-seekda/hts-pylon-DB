import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const VIENNA_TIMEZONE = 'Europe/Vienna';

export class TimezoneUtils {
  // Convert any date to Vienna timezone
  static toVienna(date?: string | Date | dayjs.Dayjs) {
    return dayjs(date).tz(VIENNA_TIMEZONE);
  }

  // Convert Vienna time to UTC for API calls
  static toUTC(date?: string | Date | dayjs.Dayjs) {
    return dayjs.tz(date, VIENNA_TIMEZONE).utc();
  }

  // Get start of day in Vienna timezone
  static getStartOfDay(date?: string | Date | dayjs.Dayjs) {
    return this.toVienna(date).startOf('day');
  }

  // Get end of day in Vienna timezone
  static getEndOfDay(date?: string | Date | dayjs.Dayjs) {
    return this.toVienna(date).endOf('day');
  }

  // Get start of week (Monday) in Vienna timezone
  static getStartOfWeek(date?: string | Date | dayjs.Dayjs) {
    return this.toVienna(date).startOf('week');
  }

  // Get end of week (Sunday) in Vienna timezone
  static getEndOfWeek(date?: string | Date | dayjs.Dayjs) {
    return this.toVienna(date).endOf('week');
  }

  // Get date presets for the UI
  static getDatePresets() {
    const now = this.toVienna();
    
    return {
      thisWeek: {
        label: 'This Week',
        from: this.getStartOfWeek(now).format('YYYY-MM-DD'),
        to: this.getEndOfWeek(now).format('YYYY-MM-DD')
      },
      lastWeek: {
        label: 'Last Week',
        from: this.getStartOfWeek(now.subtract(1, 'week')).format('YYYY-MM-DD'),
        to: this.getEndOfWeek(now.subtract(1, 'week')).format('YYYY-MM-DD')
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
  static validateDateRange(from: string, to: string) {
    const fromDate = this.toVienna(from);
    const toDate = this.toVienna(to);
    const now = this.toVienna();

    // Ensure to >= from
    if (toDate.isBefore(fromDate)) {
      throw new Error('End date must be after start date');
    }

    // Clamp to not exceed today
    const clampedTo = toDate.isAfter(now) ? now : toDate;
    const clampedFrom = fromDate.isAfter(clampedTo) ? clampedTo : fromDate;

    return {
      from: clampedFrom.format('YYYY-MM-DD'),
      to: clampedTo.format('YYYY-MM-DD')
    };
  }

  // Format date for display in Vienna timezone
  static formatForDisplay(date: string | Date | dayjs.Dayjs, format = 'YYYY-MM-DD') {
    return this.toVienna(date).format(format);
  }

  // Check if a date is today in Vienna timezone
  static isToday(date: string | Date | dayjs.Dayjs) {
    return this.toVienna(date).isSame(this.toVienna(), 'day');
  }

  // Get yesterday in Vienna timezone
  static getYesterday() {
    return this.toVienna().subtract(1, 'day');
  }
}

export default TimezoneUtils;


