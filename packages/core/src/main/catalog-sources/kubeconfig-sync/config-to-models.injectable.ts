/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import type { KubeConfig } from "@kubernetes/client-node";
import { getInjectable } from "@ogre-tools/injectable";
import type { ClusterConfigData, UpdateClusterModel } from "../../../common/cluster-types";
import { splitConfig } from "../../../common/kube-helpers";
import kubeconfigSyncLoggerInjectable from "./logger.injectable";

export type ConfigToModels = (rootConfig: KubeConfig, filePath: string) => [UpdateClusterModel, ClusterConfigData][];

const configToModelsInjectable = getInjectable({
  id: "config-to-models",
  instantiate: (di): ConfigToModels => {
    const logger = di.inject(kubeconfigSyncLoggerInjectable);

    return (rootConfig, filePath) => {
      const validConfigs: ReturnType<ConfigToModels> = [];

      let lensContext = process.env.LENS_CONTEXT?.split(",").map((context) => context.toLowerCase());

      for (const { config, validationResult } of splitConfig(rootConfig)) {
        
        // DB: Speed up startup time when there is a large number of clusters
        // Skip contexts that are not included in lensContext
        if (lensContext && !lensContext.includes(config.currentContext.toLowerCase())) {
          continue;
        }

        if (validationResult.error) {
          logger.debug(`context failed validation: ${validationResult.error}`, { context: config.currentContext, filePath });
        } else {
          validConfigs.push([
            {
              kubeConfigPath: filePath,
              contextName: config.currentContext,
            },
            {
              clusterServerUrl: validationResult.cluster.server,
            },
          ]);
        }
      }

      return validConfigs;
    };
  },
});

export default configToModelsInjectable;
