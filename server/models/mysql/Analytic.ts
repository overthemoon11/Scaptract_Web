import { getConnection } from '../../lib/mysql.ts';

interface AnalyticData {
  id?: number | string;
  file_type_id: number | string;
  metric_type: string;
  value: number;
  date_recorded?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_type_name?: string;
}

interface AggregatedMetric {
  metric_type: string;
  count: number;
  average_value: number;
  total_value: number;
  min_value: number;
  max_value: number;
}

class Analytic {
  id?: number | string;
  file_type_id: number | string;
  metric_type: string;
  value: number;
  date_recorded?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
  file_type_name?: string;

  constructor(data: AnalyticData) {
    this.id = data.id;
    this.file_type_id = data.file_type_id;
    this.metric_type = data.metric_type;
    this.value = data.value;
    this.date_recorded = data.date_recorded;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.file_type_name = data.file_type_name;
  }

  static async create(analyticData: Omit<AnalyticData, 'id' | 'created_at' | 'updated_at' | 'file_type_name'>): Promise<number> {
    const connection = await getConnection();
    try {
      const query = `
        INSERT INTO analytics (file_type_id, metric_type, value, date_recorded)
        VALUES (?, ?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        analyticData.file_type_id,
        analyticData.metric_type,
        analyticData.value,
        analyticData.date_recorded || new Date()
      ]) as any;

      return result.insertId;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async findByFileType(fileTypeId: number | string, metricType: string | null = null): Promise<Analytic[]> {
    const connection = await getConnection();
    try {
      let query = `
        SELECT a.*, ft.name as file_type_name
        FROM analytics a
        LEFT JOIN file_types ft ON a.file_type_id = ft.id
        WHERE a.file_type_id = ?
      `;
      let params: any[] = [fileTypeId];

      if (metricType) {
        query += ' AND a.metric_type = ?';
        params.push(metricType);
      }

      query += ' ORDER BY a.date_recorded DESC';

      const [rows] = await connection.execute(query, params) as any;
      return rows.map((row: AnalyticData) => new Analytic(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async getMetricsByType(metricType: string, startDate: Date | string | null = null, endDate: Date | string | null = null): Promise<Analytic[]> {
    const connection = await getConnection();
    try {
      let query = `
        SELECT a.*, ft.name as file_type_name
        FROM analytics a
        LEFT JOIN file_types ft ON a.file_type_id = ft.id
        WHERE a.metric_type = ?
      `;
      let params: any[] = [metricType];

      if (startDate) {
        query += ' AND a.date_recorded >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND a.date_recorded <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY a.date_recorded DESC';

      const [rows] = await connection.execute(query, params) as any;
      return rows.map((row: AnalyticData) => new Analytic(row));
    } finally {
      // Connection pool is managed globally
    }
  }

  static async getAggregatedMetrics(startDate: Date | string | null = null, endDate: Date | string | null = null): Promise<AggregatedMetric[]> {
    const connection = await getConnection();
    try {
      let query = `
        SELECT 
          metric_type,
          COUNT(*) as count,
          AVG(value) as average_value,
          SUM(value) as total_value,
          MIN(value) as min_value,
          MAX(value) as max_value
        FROM analytics
        WHERE 1=1
      `;
      let params: any[] = [];

      if (startDate) {
        query += ' AND date_recorded >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND date_recorded <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY metric_type ORDER BY metric_type';

      const [rows] = await connection.execute(query, params) as any;
      return rows as AggregatedMetric[];
    } finally {
      // Connection pool is managed globally
    }
  }

  static async updateValue(id: number | string, value: number): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = `
        UPDATE analytics 
        SET value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const [result] = await connection.execute(query, [value, id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }

  static async delete(id: number | string): Promise<boolean> {
    const connection = await getConnection();
    try {
      const query = 'DELETE FROM analytics WHERE id = ?';
      const [result] = await connection.execute(query, [id]) as any;
      return result.affectedRows > 0;
    } finally {
      // Connection pool is managed globally
    }
  }
}

export default Analytic;

