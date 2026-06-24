# Dashboard And Real-Time Chart Design References

Date: 2026-06-17

Purpose: UI redesign reference for the Well Control System React/Vite frontend.

## Sources Checked

- Grafana time series visualization documentation: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/time-series/
- Grafana legend documentation: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-legend/
- Grafana threshold documentation: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-thresholds/
- Grafana stat panel documentation: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/stat/
- Netdata real-time monitoring documentation: https://learn.netdata.cloud/docs/welcome-to-netdata/real-time-monitoring
- Netdata charts documentation: https://learn.netdata.cloud/docs/dashboards-and-charts/charts
- Recharts homepage/documentation entry: https://recharts.org/

## Design Takeaways Applied

- Use time-series panels as the primary evidence surface for changing sensor values.
- Keep legends compact and close to the chart so curve identity remains readable.
- Make thresholds visible through color, reference lines, and status states instead of long explanatory text.
- Use stat panels with compact sparklines for current values, following the monitoring-dashboard pattern of "current value + short history".
- Preserve high-density real-time monitoring behavior: status, sample count, last update, and alerts remain visible without taking space from the main trend area.
- Use Recharts for React-native implementation because the project already depends on it.
