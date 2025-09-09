const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isoWeek = require('dayjs/plugin/isoWeek');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const databaseService = require('./database');
const BusinessHoursCalculator = require('../utils/businessHours');

class TicketLifecycleAggregationService {
  constructor() {
    this.businessHours = new BusinessHoursCalculator();
    this.timezone = 'Europe/Vienna';
  }

  /**
   * Run daily aggregation for a specific date
   * @param {Date|string} date - Date to aggregate (in Vienna timezone)
   */
  async runDailyAggregation(date) {
    const targetDate = dayjs(date).tz(this.timezone).startOf('day');
    const nextDay = targetDate.add(1, 'day');
    
    console.log(`🔄 Running daily aggregation for ${targetDate.format('YYYY-MM-DD')}...`);

    try {
      // Get all segments that ended on this date
      const segments = await databaseService.query(`
        SELECT 
          status,
          entered_at_utc,
          left_at_utc,
          EXTRACT(EPOCH FROM (left_at_utc - entered_at_utc)) as wall_duration_seconds
        FROM ticket_status_segments
        WHERE left_at_utc IS NOT NULL
          AND DATE(left_at_utc AT TIME ZONE 'UTC' AT TIME ZONE $1) = $2
        ORDER BY status, left_at_utc
      `, [this.timezone, targetDate.format('YYYY-MM-DD')]);

      if (segments.rows.length === 0) {
        console.log(`   No segments found for ${targetDate.format('YYYY-MM-DD')}`);
        return;
      }

      // Group segments by status
      const statusGroups = {};
      for (const segment of segments.rows) {
        if (!statusGroups[segment.status]) {
          statusGroups[segment.status] = [];
        }
        statusGroups[segment.status].push(segment);
      }

      // Calculate averages for each status
      for (const [status, statusSegments] of Object.entries(statusGroups)) {
        let totalWallSeconds = 0;
        let totalBusinessSeconds = 0;
        let validSegments = 0;

        for (const segment of statusSegments) {
          const wallDuration = parseFloat(segment.wall_duration_seconds);
          const businessDuration = this.businessHours.calculateBusinessHours(
            segment.entered_at_utc,
            segment.left_at_utc
          );

          if (wallDuration > 0) {
            totalWallSeconds += wallDuration;
            totalBusinessSeconds += businessDuration;
            validSegments++;
          }
        }

        if (validSegments > 0) {
          const avgWallSeconds = Math.round(totalWallSeconds / validSegments);
          const avgBusinessSeconds = Math.round(totalBusinessSeconds / validSegments);

          // Upsert daily aggregation
          await databaseService.query(`
            INSERT INTO ticket_status_agg_daily (
              bucket_date, status, avg_duration_wall_seconds, 
              avg_duration_business_seconds, count_segments
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (bucket_date, status)
            DO UPDATE SET
              avg_duration_wall_seconds = EXCLUDED.avg_duration_wall_seconds,
              avg_duration_business_seconds = EXCLUDED.avg_duration_business_seconds,
              count_segments = EXCLUDED.count_segments,
              updated_at = now()
          `, [
            targetDate.format('YYYY-MM-DD'),
            status,
            avgWallSeconds,
            avgBusinessSeconds,
            validSegments
          ]);

          console.log(`   ✅ ${status}: ${validSegments} segments, avg wall: ${this.businessHours.formatDurationShort(avgWallSeconds)}, avg business: ${this.businessHours.formatDurationShort(avgBusinessSeconds)}`);
        }
      }

      console.log(`✅ Daily aggregation completed for ${targetDate.format('YYYY-MM-DD')}`);

    } catch (error) {
      console.error(`❌ Daily aggregation failed for ${targetDate.format('YYYY-MM-DD')}:`, error);
      throw error;
    }
  }

  /**
   * Run weekly aggregation for a specific ISO week
   * @param {number} year - ISO year
   * @param {number} week - ISO week number
   */
  async runWeeklyAggregation(year, week) {
    console.log(`🔄 Running weekly aggregation for ${year}-W${week.toString().padStart(2, '0')}...`);

    try {
      // Get all segments that ended in this week
      const segments = await databaseService.query(`
        SELECT 
          status,
          entered_at_utc,
          left_at_utc,
          EXTRACT(EPOCH FROM (left_at_utc - entered_at_utc)) as wall_duration_seconds
        FROM ticket_status_segments
        WHERE left_at_utc IS NOT NULL
          AND EXTRACT(ISOYEAR FROM left_at_utc AT TIME ZONE 'UTC' AT TIME ZONE $1) = $2
          AND EXTRACT(WEEK FROM left_at_utc AT TIME ZONE 'UTC' AT TIME ZONE $1) = $3
        ORDER BY status, left_at_utc
      `, [this.timezone, year, week]);

      if (segments.rows.length === 0) {
        console.log(`   No segments found for ${year}-W${week.toString().padStart(2, '0')}`);
        return;
      }

      // Group segments by status
      const statusGroups = {};
      for (const segment of segments.rows) {
        if (!statusGroups[segment.status]) {
          statusGroups[segment.status] = [];
        }
        statusGroups[segment.status].push(segment);
      }

      // Calculate averages for each status
      for (const [status, statusSegments] of Object.entries(statusGroups)) {
        let totalWallSeconds = 0;
        let totalBusinessSeconds = 0;
        let validSegments = 0;

        for (const segment of statusSegments) {
          const wallDuration = parseFloat(segment.wall_duration_seconds);
          const businessDuration = this.businessHours.calculateBusinessHours(
            segment.entered_at_utc,
            segment.left_at_utc
          );

          if (wallDuration > 0) {
            totalWallSeconds += wallDuration;
            totalBusinessSeconds += businessDuration;
            validSegments++;
          }
        }

        if (validSegments > 0) {
          const avgWallSeconds = Math.round(totalWallSeconds / validSegments);
          const avgBusinessSeconds = Math.round(totalBusinessSeconds / validSegments);

          // Upsert weekly aggregation
          await databaseService.query(`
            INSERT INTO ticket_status_agg_weekly (
              bucket_iso_year, bucket_iso_week, status, 
              avg_duration_wall_seconds, avg_duration_business_seconds, count_segments
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (bucket_iso_year, bucket_iso_week, status)
            DO UPDATE SET
              avg_duration_wall_seconds = EXCLUDED.avg_duration_wall_seconds,
              avg_duration_business_seconds = EXCLUDED.avg_duration_business_seconds,
              count_segments = EXCLUDED.count_segments,
              updated_at = now()
          `, [
            year,
            week,
            status,
            avgWallSeconds,
            avgBusinessSeconds,
            validSegments
          ]);

          console.log(`   ✅ ${status}: ${validSegments} segments, avg wall: ${this.businessHours.formatDurationShort(avgWallSeconds)}, avg business: ${this.businessHours.formatDurationShort(avgBusinessSeconds)}`);
        }
      }

      console.log(`✅ Weekly aggregation completed for ${year}-W${week.toString().padStart(2, '0')}`);

    } catch (error) {
      console.error(`❌ Weekly aggregation failed for ${year}-W${week.toString().padStart(2, '0')}:`, error);
      throw error;
    }
  }

  /**
   * Run aggregation for a date range
   * @param {Date|string} fromDate - Start date
   * @param {Date|string} toDate - End date
   * @param {string} grouping - 'day' or 'week'
   */
  async runAggregationForRange(fromDate, toDate, grouping = 'day') {
    const start = dayjs(fromDate).tz(this.timezone);
    const end = dayjs(toDate).tz(this.timezone);

    console.log(`🔄 Running ${grouping} aggregation from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}...`);

    if (grouping === 'day') {
      let current = start;
      while (current.isSameOrBefore(end, 'day')) {
        await this.runDailyAggregation(current.toDate());
        current = current.add(1, 'day');
      }
    } else if (grouping === 'week') {
      // Get all ISO weeks in the range
      const weeks = new Set();
      let current = start;
      
      while (current.isSameOrBefore(end, 'day')) {
        const year = current.isoYear();
        const week = current.isoWeek();
        weeks.add(`${year}-${week}`);
        current = current.add(1, 'week');
      }

      for (const weekKey of weeks) {
        const [year, week] = weekKey.split('-').map(Number);
        await this.runWeeklyAggregation(year, week);
      }
    }

    console.log(`✅ ${grouping} aggregation completed for range`);
  }

  /**
   * Get aggregation data for frontend
   * @param {Object} params - Query parameters
   * @returns {Object} Aggregated data
   */
  async getAggregationData(params) {
    const {
      from,
      to,
      grouping = 'day',
      hoursMode = 'business',
      status = null
    } = params;

    const startDate = dayjs(from).tz(this.timezone).format('YYYY-MM-DD');
    const endDate = dayjs(to).tz(this.timezone).format('YYYY-MM-DD');

    let query, queryParams;

    if (grouping === 'day') {
      query = `
        SELECT 
          bucket_date as date,
          status,
          avg_duration_wall_seconds,
          avg_duration_business_seconds,
          count_segments
        FROM ticket_status_agg_daily
        WHERE bucket_date >= $1 AND bucket_date <= $2
        ${status && status.length > 0 ? 'AND status IN (' + status.map((_, i) => `$${i + 3}`).join(',') + ')' : ''}
        ORDER BY bucket_date, status
      `;
      queryParams = status && status.length > 0 ? [startDate, endDate, ...status] : [startDate, endDate];
      console.log('Daily query params:', queryParams);
      console.log('Status array:', status);
    } else {
      query = `
        SELECT 
          bucket_iso_year,
          bucket_iso_week,
          status,
          avg_duration_wall_seconds,
          avg_duration_business_seconds,
          count_segments
        FROM ticket_status_agg_weekly
        WHERE (bucket_iso_year, bucket_iso_week) >= (
          SELECT EXTRACT(ISOYEAR FROM $1::date AT TIME ZONE $4), 
                 EXTRACT(WEEK FROM $1::date AT TIME ZONE $4)
        ) AND (bucket_iso_year, bucket_iso_week) <= (
          SELECT EXTRACT(ISOYEAR FROM $2::date AT TIME ZONE $4), 
                 EXTRACT(WEEK FROM $2::date AT TIME ZONE $4)
        )
        ${status && status.length > 0 ? 'AND status IN (' + status.map((_, i) => `$${i + 3}`).join(',') + ')' : ''}
        ORDER BY bucket_iso_year, bucket_iso_week, status
      `;
      queryParams = status && status.length > 0 ? [startDate, endDate, ...status, this.timezone] : [startDate, endDate, this.timezone];
    }

    const result = await databaseService.query(query, queryParams);
    
    // Transform data for frontend
    const data = result.rows.map(row => {
      const durationField = hoursMode === 'business' ? 'avg_duration_business_seconds' : 'avg_duration_wall_seconds';
      const duration = row[durationField];
      
      const baseData = {
        status: row.status,
        avgDurationSeconds: duration,
        avgDurationFormatted: this.businessHours.formatDurationShort(duration),
        countSegments: row.count_segments
      };

      if (grouping === 'day') {
        return {
          ...baseData,
          date: dayjs(row.date).format('YYYY-MM-DD')
        };
      } else {
        return {
          ...baseData,
          year: row.bucket_iso_year,
          week: row.bucket_iso_week,
          date: `${row.bucket_iso_year}-W${row.bucket_iso_week.toString().padStart(2, '0')}`
        };
      }
    });

    return {
      data,
      grouping,
      hoursMode,
      from: startDate,
      to: endDate,
      totalSamples: data.reduce((sum, item) => sum + item.countSegments, 0)
    };
  }
}

module.exports = TicketLifecycleAggregationService;
