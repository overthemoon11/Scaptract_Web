import { getConnection } from '../../lib/supabase.ts';

interface AnalyticData {
  id?: string;
  file_type_id: string | null;
  metric_type: string;
  value: number;
  date_recorded?: string;
  created_at?: string;
  updated_at?: string;
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
  id?: string;
  file_type_id: string | null;
  metric_type: string;
  value: number;
  date_recorded?: string;
  created_at?: string;
  updated_at?: string;
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

  static async create(analyticData: Omit<AnalyticData, 'id' | 'created_at' | 'updated_at' | 'file_type_name'>): Promise<string> {
    const supabase = getConnection();
    const { data, error } = await supabase
      .from('analytics')
      .insert({
        file_type_id: analyticData.file_type_id,
        metric_type: analyticData.metric_type,
        value: analyticData.value,
        date_recorded: analyticData.date_recorded || new Date().toISOString().split('T')[0]
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async findByFileType(fileTypeId: string | number, metricType: string | null = null): Promise<Analytic[]> {
    const supabase = getConnection();
    let query = supabase
      .from('analytics')
      .select('*, file_types(name)')
      .eq('file_type_id', fileTypeId.toString());

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query.order('date_recorded', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => {
      const analytic = new Analytic(row);
      if (row.file_types) analytic.file_type_name = row.file_types.name;
      return analytic;
    });
  }

  static async getMetricsByType(metricType: string, startDate: string | null = null, endDate: string | null = null): Promise<Analytic[]> {
    const supabase = getConnection();
    let query = supabase
      .from('analytics')
      .select('*, file_types(name)')
      .eq('metric_type', metricType);

    if (startDate) {
      query = query.gte('date_recorded', startDate);
    }
    if (endDate) {
      query = query.lte('date_recorded', endDate);
    }

    const { data, error } = await query.order('date_recorded', { ascending: false });

    if (error || !data) return [];
    return data.map((row: any) => {
      const analytic = new Analytic(row);
      if (row.file_types) analytic.file_type_name = row.file_types.name;
      return analytic;
    });
  }

  static async getAggregatedMetrics(startDate: string | null = null, endDate: string | null = null): Promise<AggregatedMetric[]> {
    const supabase = getConnection();
    let query = supabase.from('analytics').select('metric_type, value');

    if (startDate) {
      query = query.gte('date_recorded', startDate);
    }
    if (endDate) {
      query = query.lte('date_recorded', endDate);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    // Aggregate the data
    const grouped = data.reduce((acc: any, row: any) => {
      if (!acc[row.metric_type]) {
        acc[row.metric_type] = {
          metric_type: row.metric_type,
          values: []
        };
      }
      acc[row.metric_type].values.push(row.value);
      return acc;
    }, {});

    return Object.values(grouped).map((group: any) => {
      const values = group.values;
      return {
        metric_type: group.metric_type,
        count: values.length,
        average_value: values.reduce((a: number, b: number) => a + b, 0) / values.length,
        total_value: values.reduce((a: number, b: number) => a + b, 0),
        min_value: Math.min(...values),
        max_value: Math.max(...values)
      };
    });
  }

  static async updateValue(id: string | number, value: number): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('analytics')
      .update({ value })
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }

  static async delete(id: string | number): Promise<boolean> {
    const supabase = getConnection();
    const { error } = await supabase
      .from('analytics')
      .delete()
      .eq('id', id.toString());

    if (error) throw error;
    return true;
  }
}

export default Analytic;

