import Command from '@shopify/cli-kit/node/base-command';
import {outputSuccess, outputWarn} from '@shopify/cli-kit/node/output';

import {commonFlags} from '../../lib/flags.js';
import {getConfig, unsetStorefront} from '../../lib/shopify-config.js';

export default class Unlink extends Command {
  static description =
    "Unlink your local development from your shop's Hydrogen storefront.";

  static hidden = true;

  static flags = {
    path: commonFlags.path,
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(Unlink);
    await unlinkStorefront(flags);
  }
}

export interface LinkFlags {
  path?: string;
}

export async function unlinkStorefront({path}: LinkFlags) {
  const actualPath = path ?? process.cwd();
  const {storefront: configStorefront} = await getConfig(actualPath);

  if (!configStorefront) {
    outputWarn('You are not currently linked to a Hydrogen storefront.');
    return;
  }

  const storefrontTitle = configStorefront.title;

  await unsetStorefront(actualPath);

  outputSuccess(`You are no longer linked to ${storefrontTitle}`);
}
