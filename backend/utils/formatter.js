/**
 * Data Formatter Utility
 * Formats database query results for visualization
 */

class DataFormatter {
  /**
   * Format raw database results for visualization
   * @param {Array} rawData - Raw database query results
   * @param {string} originalQuery - Original natural language query
   * @returns {Object} - Formatted data for charts
   */
  formatForVisualization(rawData, originalQuery) {
    if (!rawData || rawData.length === 0) {
      throw new Error('No data to format');
    }

    const queryLower = originalQuery.toLowerCase();
    const columns = Object.keys(rawData[0]);
    
    // Determine chart type based on query content and data structure
    const chartType = this.determineChartType(queryLower, rawData, columns);
    
    // Format data based on chart type
    let formattedData;
    let title;
    let description;

    switch (chartType) {
      case 'pie':
        formattedData = this.formatPieChart(rawData, columns);
        title = this.generateTitle(queryLower, 'Distribution');
        description = `Distribution breakdown showing ${rawData.length} categories`;
        break;

      case 'line':
        formattedData = this.formatLineChart(rawData, columns);
        title = this.generateTitle(queryLower, 'Trend Analysis');
        description = `Time series analysis showing trends over ${rawData.length} periods`;
        break;

      case 'scatter':
        formattedData = this.formatScatterChart(rawData, columns);
        title = this.generateTitle(queryLower, 'Correlation Analysis');
        description = `Scatter plot showing relationship between variables`;
        break;

      default: // bar chart
        formattedData = this.formatBarChart(rawData, columns);
        title = this.generateTitle(queryLower, 'Performance Analysis');
        description = `Comparative analysis across ${rawData.length} categories`;
        break;
    }

    return {
      data: formattedData,
      chartType,
      title,
      description,
      columns
    };
  }

  /**
   * Determine appropriate chart type based on query and data
   * @param {string} query - Lowercase query string
   * @param {Array} data - Raw data array
   * @param {Array} columns - Column names
   * @returns {string} - Chart type
   */
  determineChartType(query, data, columns) {
    // Pie chart indicators
    if (query.includes('pie') || 
        query.includes('distribution') || 
        query.includes('share') ||
        query.includes('percentage') ||
        query.includes('proportion')) {
      return 'pie';
    }

    // Line chart indicators
    if (query.includes('line') || 
        query.includes('trend') || 
        query.includes('time') ||
        query.includes('over time') ||
        query.includes('timeline') ||
        this.hasTimeColumn(columns)) {
      return 'line';
    }

    // Scatter plot indicators
    if (query.includes('scatter') || 
        query.includes('correlation') || 
        query.includes('relationship') ||
        (columns.length >= 2 && this.hasNumericColumns(data, 2))) {
      return 'scatter';
    }

    // Default to bar chart
    return 'bar';
  }

  /**
   * Format data for pie chart
   * @param {Array} data - Raw data
   * @param {Array} columns - Column names
   * @returns {Array} - Formatted pie chart data
   */
  formatPieChart(data, columns) {
    const labelColumn = columns.find(col => 
      typeof data[0][col] === 'string' || 
      col.toLowerCase().includes('name') ||
      col.toLowerCase().includes('category')
    ) || columns[0];

    const valueColumn = columns.find(col => 
      typeof data[0][col] === 'number' ||
      col.toLowerCase().includes('amount') ||
      col.toLowerCase().includes('count') ||
      col.toLowerCase().includes('value')
    ) || columns[1];

    const labels = data.map(row => row[labelColumn]);
    const values = data.map(row => parseFloat(row[valueColumn]) || 0);

    return [{
      values,
      labels,
      type: 'pie',
      name: 'Distribution',
      textinfo: 'label+percent',
      textposition: 'outside',
      hovertemplate: '<b>%{label}</b><br>Value: %{value}<br>Share: %{percent}<extra></extra>',
      marker: {
        colors: this.generateColors(values.length),
        line: { color: '#FFFFFF', width: 2 }
      }
    }];
  }

  /**
   * Format data for line chart
   * @param {Array} data - Raw data
   * @param {Array} columns - Column names
   * @returns {Array} - Formatted line chart data
   */
  formatLineChart(data, columns) {
    const xColumn = columns.find(col => 
      this.isTimeColumn(col) ||
      col.toLowerCase().includes('date') ||
      col.toLowerCase().includes('time') ||
      col.toLowerCase().includes('period')
    ) || columns[0];

    const yColumn = columns.find(col => 
      typeof data[0][col] === 'number' && col !== xColumn
    ) || columns[1];

    const x = data.map(row => row[xColumn]);
    const y = data.map(row => parseFloat(row[yColumn]) || 0);

    return [{
      x,
      y,
      type: 'scatter',
      mode: 'lines+markers',
      name: yColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      line: { color: '#10B981', width: 3 },
      marker: { color: '#10B981', size: 8 },
      hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>'
    }];
  }

  /**
   * Format data for scatter chart
   * @param {Array} data - Raw data
   * @param {Array} columns - Column names
   * @returns {Array} - Formatted scatter chart data
   */
  formatScatterChart(data, columns) {
    const numericColumns = columns.filter(col => 
      typeof data[0][col] === 'number'
    );

    const xColumn = numericColumns[0] || columns[0];
    const yColumn = numericColumns[1] || columns[1];

    const x = data.map(row => parseFloat(row[xColumn]) || 0);
    const y = data.map(row => parseFloat(row[yColumn]) || 0);

    return [{
      x,
      y,
      type: 'scatter',
      mode: 'markers',
      name: 'Data Points',
      marker: {
        color: '#3B82F6',
        size: 10,
        opacity: 0.7
      },
      hovertemplate: `<b>${xColumn}</b>: %{x}<br><b>${yColumn}</b>: %{y}<extra></extra>`
    }];
  }

  /**
   * Format data for bar chart
   * @param {Array} data - Raw data
   * @param {Array} columns - Column names
   * @returns {Array} - Formatted bar chart data
   */
  formatBarChart(data, columns) {
    const xColumn = columns.find(col => 
      typeof data[0][col] === 'string' ||
      col.toLowerCase().includes('name') ||
      col.toLowerCase().includes('category')
    ) || columns[0];

    const yColumn = columns.find(col => 
      typeof data[0][col] === 'number' && col !== xColumn
    ) || columns[1];

    const x = data.map(row => row[xColumn]);
    const y = data.map(row => parseFloat(row[yColumn]) || 0);

    return [{
      x,
      y,
      type: 'bar',
      name: yColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      marker: {
        color: this.generateColors(y.length),
        line: { color: '#1F2937', width: 1 }
      },
      hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>'
    }];
  }

  /**
   * Generate title based on query content
   * @param {string} query - Lowercase query
   * @param {string} defaultSuffix - Default suffix for title
   * @returns {string} - Generated title
   */
  generateTitle(query, defaultSuffix) {
    if (query.includes('sales')) return `Sales ${defaultSuffix}`;
    if (query.includes('revenue')) return `Revenue ${defaultSuffix}`;
    if (query.includes('customer')) return `Customer ${defaultSuffix}`;
    if (query.includes('product')) return `Product ${defaultSuffix}`;
    if (query.includes('performance')) return `Performance ${defaultSuffix}`;
    
    return `Data ${defaultSuffix}`;
  }

  /**
   * Check if column represents time data
   * @param {string} columnName - Column name
   * @returns {boolean} - Is time column
   */
  isTimeColumn(columnName) {
    const timeIndicators = ['date', 'time', 'timestamp', 'created_at', 'updated_at', 'period', 'quarter', 'month', 'year'];
    return timeIndicators.some(indicator => 
      columnName.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if data has time columns
   * @param {Array} columns - Column names
   * @returns {boolean} - Has time column
   */
  hasTimeColumn(columns) {
    return columns.some(col => this.isTimeColumn(col));
  }

  /**
   * Check if data has specified number of numeric columns
   * @param {Array} data - Raw data
   * @param {number} minCount - Minimum numeric columns required
   * @returns {boolean} - Has enough numeric columns
   */
  hasNumericColumns(data, minCount) {
    if (!data || data.length === 0) return false;
    
    const numericColumns = Object.keys(data[0]).filter(col => 
      typeof data[0][col] === 'number'
    );
    
    return numericColumns.length >= minCount;
  }

  /**
   * Generate color palette for charts
   * @param {number} count - Number of colors needed
   * @returns {Array} - Array of color codes
   */
  generateColors(count) {
    const baseColors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
      '#6366F1', '#84CC16', '#F43F5E', '#06B6D4'
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    // Generate additional colors if needed
    const colors = [...baseColors];
    for (let i = baseColors.length; i < count; i++) {
      const hue = (i * 137.508) % 360; // Golden angle approximation
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }

    return colors;
  }
}

module.exports = new DataFormatter();