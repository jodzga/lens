/**
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
import type { DiContainer } from "@ogre-tools/injectable";
import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
import { registerMobX } from "@ogre-tools/injectable-extension-for-mobx";
import { runInAction } from "mobx";
import { Environments, setLegacyGlobalDiForExtensionApi } from "../extensions/as-legacy-globals-for-extension-api/legacy-global-di-for-extension-api";

export function registerInjectables(di: DiContainer) {
  setLegacyGlobalDiForExtensionApi(di, Environments.main);

  runInAction(() => {
    registerMobX(di);

    autoRegister({
      di,
      targetModule: module,
      getRequireContexts: () => [
        require.context("./", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
        require.context("../extensions", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
        require.context("../common", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
        require.context("../features", true, CONTEXT_MATCHER_FOR_FEATURES),
      ],
    });
  });

  return di;
}
