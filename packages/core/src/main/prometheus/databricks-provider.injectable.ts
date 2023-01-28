/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { bytesSent, prometheusProviderInjectionToken, findNamespacedService, createPrometheusProvider } from "./provider";
import type {  PrometheusProvider } from "./provider";
import { getInjectable } from "@ogre-tools/injectable";

export const getDatabricksLikeQueryFor = ({ rateAccuracy }: { rateAccuracy: string }): PrometheusProvider["getQuery"] => (
  (opts, queryName) => {
    let numberOfNodes = opts.nodes? opts.nodes.split("|").length - 1 : 0;
    let filterOutMasterNodes = "";
    let filterOutMasterNodesGroupLeft  = "";
    let filterOutMasterNodesRelabeled = "";
    let filterOutMasterNodesRelabeledGroupLeft = "";
    let filterOutMasterNodesRelabeledInstance = "";
    // M3 has an issue with queries with too many nodes: it fails with "Error: dfa contains more than 10000 states"
    // We workaround this problem by replacing nodes with ".*" if number of nodes is greater than 5 and filtering out master nodes.
    // We assume that when query has more than 5 nodes then it is a query for all worker nodes.
    if (numberOfNodes > 5) {
      opts = { ...opts, nodes: ".*" };
      filterOutMasterNodes = ' * on (node) kube_node_labels{label_pool!="master"}';
      filterOutMasterNodesGroupLeft = ' * on (node) group_left kube_node_labels{label_pool!="master"}';
      filterOutMasterNodesRelabeled = ' * on (kubernetes_pod_node_name) label_replace(kube_node_labels{label_pool!="master"}, "kubernetes_pod_node_name", "$1", "node", "(.+)")';
      filterOutMasterNodesRelabeledGroupLeft = ' * on (kubernetes_pod_node_name) group_left label_replace(kube_node_labels{label_pool!="master"}, "kubernetes_pod_node_name", "$1", "node", "(.+)")';
      filterOutMasterNodesRelabeledInstance = ' * on (instance) label_replace(kube_node_labels{label_pool!="master"}, "instance", "$1", "node", "(.+)")';
    }
    // Replace the label the metric was grouped by
    const replaceGroupingLabel = (metric: string, oldLabel: string, newLabel: string) => {
      return 'sum(label_replace(' + metric + ', "' + newLabel + '", "$1", "' + oldLabel + '", "(.+)")) by (' + newLabel + ')';
    };
    switch(opts.category) {
      case "cluster":
        switch (queryName) {
          case "memoryUsage":
            return `sum(node_memory_MemTotal_bytes - (node_memory_MemFree_bytes + node_memory_Buffers_bytes + node_memory_Cached_bytes)) by (job)`.replace(/_bytes/g, `_bytes{kubernetes_pod_node_name=~"${opts.nodes}"}${filterOutMasterNodesRelabeled}`);
          case "workloadMemoryUsage":
            return `sum(container_memory_working_set_bytes{container_name!="POD",container_name!="",kubernetes_pod_node_name=~"${opts.nodes}"}${filterOutMasterNodesRelabeledGroupLeft}) by (job)`;
          case "memoryRequests":
            return `sum(kube_pod_container_resource_requests{node=~"${opts.nodes}", resource="memory"}${filterOutMasterNodesGroupLeft}) by (job)`;
          case "memoryLimits":
            return `sum(kube_pod_container_resource_limits{node=~"${opts.nodes}", resource="memory"}${filterOutMasterNodesGroupLeft}) by (job)`;
          case "memoryCapacity":
            return `sum(kube_node_status_capacity{node=~"${opts.nodes}", resource="memory"}${filterOutMasterNodes}) by (job)`;
          case "memoryAllocatableCapacity":
            return `sum(kube_node_status_allocatable{node=~"${opts.nodes}", resource="memory"}${filterOutMasterNodes}) by (job)`;
          case "cpuUsage":
            return `sum(rate(node_cpu_seconds_total{kubernetes_pod_node_name=~"${opts.nodes}", mode=~"user|system"}[${rateAccuracy}])${filterOutMasterNodesRelabeledGroupLeft}) by (job)`;
          case "cpuRequests":
            return `sum(kube_pod_container_resource_requests{node=~"${opts.nodes}", resource="cpu"}${filterOutMasterNodesGroupLeft}) by (job)`;
          case "cpuLimits":
            return `sum(kube_pod_container_resource_limits{node=~"${opts.nodes}", resource="cpu"}${filterOutMasterNodesGroupLeft}) by (job)`;
          case "cpuCapacity":
            return `sum(kube_node_status_capacity{node=~"${opts.nodes}", resource="cpu"}${filterOutMasterNodes}) by (job)`;
          case "cpuAllocatableCapacity":
            return `sum(kube_node_status_allocatable{node=~"${opts.nodes}", resource="cpu"}${filterOutMasterNodes}) by (job)`;
          case "podUsage":
            return `sum(kubelet_running_pods{instance=~"${opts.nodes}"}${filterOutMasterNodesRelabeledInstance}) by (job)`;
          case "podCapacity":
            return `sum(kube_node_status_capacity{node=~"${opts.nodes}", resource="pods"}${filterOutMasterNodes}) by (job)`;
          case "podAllocatableCapacity":
            return `sum(kube_node_status_allocatable{node=~"${opts.nodes}", resource="pods"}${filterOutMasterNodes}) by (job)`;
          case "fsSize":
            return `sum(node_filesystem_size_bytes{kubernetes_pod_node_name=~"${opts.nodes}", mountpoint="/"}${filterOutMasterNodesRelabeled}) by (job)`;
          case "fsUsage":
            return `sum(node_filesystem_size_bytes{kubernetes_pod_node_name=~"${opts.nodes}", mountpoint="/"}${filterOutMasterNodesRelabeled} - node_filesystem_avail_bytes{kubernetes_pod_node_name=~"${opts.nodes}", mountpoint="/"}${filterOutMasterNodesRelabeled}) by (job)`;
        }
        break;
      case "nodes":
        switch (queryName) {
          case "memoryUsage":
            return replaceGroupingLabel(`sum (node_memory_MemTotal_bytes - (node_memory_MemFree_bytes + node_memory_Buffers_bytes + node_memory_Cached_bytes)) by (kubernetes_pod_node_name)`, 'kubernetes_pod_node_name', 'node');
          case "workloadMemoryUsage":
            return replaceGroupingLabel(`sum(container_memory_working_set_bytes{container_name!="POD",container_name!=""}) by (kubernetes_pod_node_name)`, 'kubernetes_pod_node_name', 'node');
          case "memoryCapacity":
            return `sum(kube_node_status_capacity{resource="memory"}) by (node)`;
          case "memoryAllocatableCapacity":
            return `sum(kube_node_status_allocatable{resource="memory"}) by (node)`;
          case "cpuUsage":
            return replaceGroupingLabel(`sum(rate(node_cpu_seconds_total{mode=~"user|system"}[${rateAccuracy}])) by(kubernetes_pod_node_name)`, 'kubernetes_pod_node_name', 'node');
          case "cpuCapacity":
            return `sum(kube_node_status_capacity{resource="cpu"}) by (node)`;
          case "cpuAllocatableCapacity":
            return `sum(kube_node_status_allocatable{resource="cpu"}) by (node)`;
          case "fsSize":
            return replaceGroupingLabel(`sum(node_filesystem_size_bytes{mountpoint="/"}) by (kubernetes_pod_node_name)`, 'kubernetes_pod_node_name', 'node');
          case "fsUsage":
            return replaceGroupingLabel(`sum(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"}) by (kubernetes_pod_node_name)`, 'kubernetes_pod_node_name', 'node');
        }
        break;
        case "pods":
          switch (queryName) {
            case "cpuUsage":
              return `sum(label_replace(label_replace(rate(container_cpu_user_seconds_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)") + label_replace(label_replace(rate(container_cpu_system_seconds_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[5m]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
            case "cpuRequests":
              return `sum(kube_pod_container_resource_requests{pod=~"${opts.pods}",resource="cpu",namespace="${opts.namespace}"}) by (${opts.selector})`;
            case "cpuLimits":
              return `sum(kube_pod_container_resource_limits{pod=~"${opts.pods}",resource="cpu",namespace="${opts.namespace}"}) by (${opts.selector})`;
            case "memoryUsage":
              return `sum(label_replace(label_replace(container_memory_working_set_bytes{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}, "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
            case "memoryRequests":
              return `sum(kube_pod_container_resource_requests{pod=~"${opts.pods}",resource="memory",namespace="${opts.namespace}"}) by (${opts.selector})`;
            case "memoryLimits":
              return `sum(kube_pod_container_resource_limits{pod=~"${opts.pods}",resource="memory",namespace="${opts.namespace}"}) by (${opts.selector})`;
            case "fsUsage":
              // This metric is missing
              return `sum(container_fs_usage_bytes{container!="POD",container!="",pod=~"${opts.pods}",namespace="${opts.namespace}"}) by (${opts.selector})`;
            case "fsWrites":
              return `sum(label_replace(label_replace(rate(container_fs_writes_bytes_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
            case "fsReads":
              return `sum(label_replace(label_replace(rate(container_fs_reads_bytes_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
            case "networkReceive":
              return `sum(label_replace(label_replace(rate(container_network_receive_bytes_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
            case "networkTransmit":
              return `sum(label_replace(label_replace(rate(container_network_transmit_bytes_total{container_name!="POD",container_name!="",pod_name=~"${opts.pods}",namespace="${opts.namespace}"}[${rateAccuracy}]), "container", "$1", "container_name", "(.+)"), "pod", "$1", "pod_name", "(.+)")) by (${opts.selector})`;
          }
        break;
      case "pvc":
        switch (queryName) {
          case "diskUsage":
            return `sum(kubelet_volume_stats_used_bytes{persistentvolumeclaim="${opts.pvc}",namespace="${opts.namespace}"}) by (persistentvolumeclaim, namespace)`;
          case "diskCapacity":
            return `sum(kubelet_volume_stats_capacity_bytes{persistentvolumeclaim="${opts.pvc}",namespace="${opts.namespace}"}) by (persistentvolumeclaim, namespace)`;
        }
        break;
      case "ingress":
        switch (queryName) {
          case "bytesSentSuccess":
            return bytesSent({
              rateAccuracy,
              ingress: opts.ingress,
              namespace: opts.namespace,
              statuses: "^2\\\\d*",
            });
          case "bytesSentFailure":
            return bytesSent({
              rateAccuracy,
              ingress: opts.ingress,
              namespace: opts.namespace,
              statuses: "^5\\\\d*",
            });
          case "requestDurationSeconds":
            return `sum(rate(nginx_ingress_controller_request_duration_seconds_sum{ingress="${opts.ingress}",namespace="${opts.namespace}"}[${rateAccuracy}])) by (ingress, namespace)`;
          case "responseDurationSeconds":
            return `sum(rate(nginx_ingress_controller_response_duration_seconds_sum{ingress="${opts.ingress}",namespace="${opts.namespace}"}[${rateAccuracy}])) by (ingress, namespace)`;
        }
        break;
    }

    throw new Error(`Unknown queryName="${queryName}" for category="${opts.category}"`);
  }
);

const databricksPrometheusProviderInjectable = getInjectable({
  id: "databricks-prometheus-provider",
  instantiate: () => createPrometheusProvider({
    kind: "databricks",
    name: "Databricks",
    isConfigurable: false,
    getQuery: getDatabricksLikeQueryFor({ rateAccuracy: "2m" }),
    getService: (client) => findNamespacedService(client, "query-frontend-read-regional-svc", "m3"),
  }),
  injectionToken: prometheusProviderInjectionToken,
});

export default databricksPrometheusProviderInjectable;

