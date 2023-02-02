/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import type { ClusterConfigData, ClusterModel } from "../cluster-types";
import readFileSyncInjectable from "../fs/read-file-sync.injectable";
import { loadConfigFromString, validateKubeConfig } from "../kube-helpers";
import fse from "fs-extra";

export type ReadClusterConfigSync = (model: ClusterModel) => ClusterConfigData;

const readClusterConfigSyncInjectable = getInjectable({
  id: "read-cluster-config-sync",
  instantiate: (di): ReadClusterConfigSync => {
    const readFileSync = di.inject(readFileSyncInjectable);

    //DB: Speed up the loading of the kubeconfig file by caching
    // Map containing the last modified timestamp of the file under kubeConfigPath
    const lastModifiedMap = new Map<string, number>();
    // Map containing the cache of the file under kubeConfigPath
    const cacheMap = new Map<string, ClusterConfigData>();
    
    return ({ kubeConfigPath, contextName }) => {

      const stats = fse.statSync(kubeConfigPath);
      const currentModified = stats.mtimeMs;
      // If the file has not been modified since the last time we read it, return cached value
      if (lastModifiedMap.has(kubeConfigPath)) {
        const lastModified = lastModifiedMap.get(kubeConfigPath);
        if (lastModified === currentModified) {
          let cached = cacheMap.get(kubeConfigPath);
          if (cached !== undefined) {
            return cached;
          }
        }
      }

      const kubeConfigData = readFileSync(kubeConfigPath);

      const { config } = loadConfigFromString(kubeConfigData);
      const result = validateKubeConfig(config, contextName);

      if (result.error) {
        throw result.error;
      }

      cacheMap.set(kubeConfigPath, { clusterServerUrl: result.cluster.server });
      lastModifiedMap.set(kubeConfigPath, currentModified)

      return { clusterServerUrl: result.cluster.server };
    };
  },
});

export default readClusterConfigSyncInjectable;
