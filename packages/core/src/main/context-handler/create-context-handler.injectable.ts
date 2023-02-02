/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import type { Cluster } from "../../common/cluster/cluster";
import type { ClusterContextHandler, ContextHandlerDependencies } from "./context-handler";
import { ContextHandler } from "./context-handler";
import createKubeAuthProxyInjectable from "../kube-auth-proxy/create-kube-auth-proxy.injectable";
import kubeAuthProxyCertificateInjectable from "../kube-auth-proxy/kube-auth-proxy-certificate.injectable";
import URLParse from "url-parse";
import getPrometheusProviderByKindInjectable from "../prometheus/get-by-kind.injectable";
import prometheusProvidersInjectable from "../prometheus/providers.injectable";
import loggerInjectable from "../../common/logger.injectable";

const createContextHandlerInjectable = getInjectable({
  id: "create-context-handler",

  instantiate: (di) => {
    const dependencies: Omit<ContextHandlerDependencies, "authProxyCaGetter"> = {
      createKubeAuthProxy: di.inject(createKubeAuthProxyInjectable),
      getPrometheusProviderByKind: di.inject(getPrometheusProviderByKindInjectable),
      prometheusProviders: di.inject(prometheusProvidersInjectable),
      logger: di.inject(loggerInjectable),
    };

    return (cluster: Cluster): ClusterContextHandler => {
      const clusterUrl = new URLParse(cluster.apiUrl);

      return new ContextHandler({
        ...dependencies,
        // DB: Speed up app loading through lazy loading of auth proxy certs
        authProxyCaGetter: () => {
          let cert = di.inject(kubeAuthProxyCertificateInjectable, clusterUrl.hostname).cert
          return cert;
        },
      }, cluster);
    };
  },
});

export default createContextHandlerInjectable;
