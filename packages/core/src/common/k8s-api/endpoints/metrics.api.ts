/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Metrics api

import moment from "moment";
import { isDefined, object } from "../../utils";

export interface MetricData {
  status: string;
  data: {
    resultType: string;
    result: MetricResult[];
  };
}

export interface MetricResult {
  metric: {
    [name: string]: string | undefined;
    instance?: string;
    node?: string;
    pod?: string;
    kubernetes?: string;
    kubernetes_node?: string;
    kubernetes_namespace?: string;
  };
  values: [number, string][];
}

// DB: Increased the number of frames to 6 * 60 (6 hours) to match the default range
export function normalizeMetrics(metrics: MetricData | undefined | null, frames = 6 * 60): MetricData {
  if (!metrics?.data?.result) {
    return {
      data: {
        resultType: "",
        result: [{
          metric: {},
          values: [],
        }],
      },
      status: "",
    };
  }

  const { result } = metrics.data;

  if (result.length) {
    if (frames > 0) {
      // fill the gaps
      result.forEach(res => {
        if (!res.values || !res.values.length) return;
        // DB: Removed filling up not-yet-existing metric values with 0s because it causes pie charts to show no current usage and ugly blanks in timeline charts
        while (res.values.length < frames) {
          const timestamp = moment.unix(res.values[0][0]).subtract(1, "minute").unix();

          if (!res.values.find((value) => value[0] === timestamp)) {
            res.values.unshift([timestamp, "0"]);
          }
        }
      });
    }
  }
  else {
    // always return at least empty values array
    result.push({
      metric: {},
      values: [],
    } as MetricResult);
  }

  return metrics;
}

export function isMetricsEmpty(metrics: Partial<Record<string, MetricData>>) {
  return Object.values(metrics).every(metric => !metric?.data?.result?.length);
}

export function getItemMetrics<Keys extends string>(metrics: Partial<Record<Keys, MetricData>> | null | undefined, itemName: string): Partial<Record<Keys, MetricData>> | undefined {
  if (!metrics) {
    return undefined;
  }

  const itemMetrics = { ...metrics };

  for (const metric in metrics) {
    if (!metrics[metric]?.data?.result) {
      continue;
    }
    const results = metrics[metric]?.data.result;
    const result = results?.find(res => Object.values(res.metric)[0] == itemName);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    itemMetrics[metric]!.data.result = result ? [result] : [];
  }

  return itemMetrics;
}

export function getMetricLastPoints<Keys extends string>(metrics: Partial<Record<Keys, MetricData>>): Partial<Record<Keys, number>> {
  return object.fromEntries(
    object.entries(metrics)
      .map(([metricName, metric]) => {
        try {
          return [metricName, +metric.data.result[0].values.slice(-1)[0][1]] as const;
        } catch {
          return undefined;
        }
      })
      .filter(isDefined),
  );
}
