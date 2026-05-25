import type { RiverGenConfig } from "@rivergen/cli";

const config: RiverGenConfig = {
  api: {
    srcRoot: "apps/api/src",
  },
  web: {
    srcRoot: "apps/web/src",
  },
  shared: {
    package: "@rivergen-demo/shared",
    srcRoot: "packages/shared/src",
  },
};

export default config;
