/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { now } from "mobx-utils";
import type { Ingress } from "../../../common/k8s-api/endpoints";
import requestIngressMetricsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-ingress-metrics.injectable";

const ingressMetricsInjectable = getInjectable({
  id: "ingress-metrics",
  instantiate: (di, ingress) => {
    const requestIngressMetrics = di.inject(requestIngressMetricsInjectable);

    return asyncComputed({
      getValueFromObservedPromise: async () => {
        now(2 * 60 * 1000); // Update every 2 minutes

        return requestIngressMetrics(ingress.getName(), ingress.getNs());
      },
    });
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, ingress: Ingress) => ingress.getId(),
  }),
});

export default ingressMetricsInjectable;
