import * as fs from "fs";
import * as os from "os";
import ts from "typescript";
import { getInjectable } from "@ogre-tools/injectable";
import getActiveClusterEntityInjectable from "../api/catalog/entity/get-active-cluster-entity.injectable";
import { NotificationStatus } from "../components/notifications/notifications.store";
import notificationsStoreInjectable from "../components/notifications/notifications-store.injectable";

export type DashboardLinksFinder = (dict: Record<string, string | undefined>) => string;

const dashboardLinksFinderInjectable = getInjectable({
  id: "dashboard-links-finder",
  instantiate: (di): DashboardLinksFinder => {
    const getActiveClusterEntity = di.inject(getActiveClusterEntityInjectable);
    const notificationsStore = di.inject(notificationsStoreInjectable);
    const linksFilePath = `${os.homedir()}/.k8slens/db/dashboard-links.ts`;
    const use = { lastModified: 0, finder: (dict: Record<string, string | undefined>) => '' };
    return (dict) => {
      try {
        const currentModified = fs.statSync(linksFilePath).mtimeMs;
        if (currentModified > use['lastModified']) {
          console.log(`${linksFilePath} has been updated since last read, recompiling...`);
          const data = fs.readFileSync(linksFilePath, { encoding: "utf8" });
          const compilerOptions = {};
          const compiled = ts.transpileModule(data, {
            compilerOptions,
            fileName: linksFilePath,
          });
          const module = eval(compiled.outputText);
          use['lastModified'] = currentModified;
          use['finder'] = module;
        }
  
        const contextName = getActiveClusterEntity()?.contextName;
        const dictWithContext = { ...dict, contextName };
  
        console.log(`dictWithContext: ${JSON.stringify(dictWithContext)}`)
  
        const dashboardLink =  use['finder'](dictWithContext);
        if (dashboardLink) {
          window.open(dashboardLink, '_blank');
        } else {
          notificationsStore.add({
            status: NotificationStatus.INFO,
            timeout: 10000,
            message: `We did not define this ${dict["linkType"]} yet.\n\nLet us know at #kubernetes-control-plane what would be helpful for you here.\nProvide this info for context: ${JSON.stringify(dictWithContext)}`,
          });
        }
        return dashboardLink;
      } catch (error) {
        notificationsStore.add({
          status: NotificationStatus.ERROR,
          timeout: 5000,
          message: `Failed to find dashboard ${JSON.stringify(dict)}: ${error}`,
        });
        return '';
      }      
    };
  },
});

export default dashboardLinksFinderInjectable;
