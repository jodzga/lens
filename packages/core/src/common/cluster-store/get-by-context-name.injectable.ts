/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import { getInjectable } from "@ogre-tools/injectable";
import type { Cluster } from "../cluster/cluster";
import clusterStoreInjectable from "./cluster-store.injectable";

export type GetClusterByContextName = (contextName: string) => Cluster | undefined;

const getClusterByContextNameInjectable = getInjectable({
  id: "get-cluster-by-context-name",
  instantiate: (di): GetClusterByContextName => {
    const store = di.inject(clusterStoreInjectable);

    return (contextName) => store.getByContextName(contextName);
  },
});

export default getClusterByContextNameInjectable;
