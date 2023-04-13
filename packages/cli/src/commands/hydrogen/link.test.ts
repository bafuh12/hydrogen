import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import type {AdminSession} from '@shopify/cli-kit/node/session';
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output';
import {
  renderConfirmationPrompt,
  renderSelectPrompt,
} from '@shopify/cli-kit/node/ui';

import {adminRequest} from '../../lib/graphql.js';
import {
  LinkStorefrontQuery,
  LinkStorefrontSchema,
} from '../../lib/graphql/admin/link-storefront.js';
import {getAdminSession} from '../../lib/admin-session.js';
import {getConfig, setStorefront} from '../../lib/shopify-config.js';

import {linkStorefront} from './link.js';

vi.mock('@shopify/cli-kit/node/ui', async () => {
  const original = await vi.importActual<
    typeof import('@shopify/cli-kit/node/ui')
  >('@shopify/cli-kit/node/ui');
  return {
    ...original,
    renderConfirmationPrompt: vi.fn(),
    renderSelectPrompt: vi.fn(),
  };
});
vi.mock('../../lib/graphql.js');
vi.mock('../../lib/shopify-config.js');
vi.mock('../../lib/admin-session.js');
vi.mock('../../lib/shop.js', () => ({
  getHydrogenShop: () => 'my-shop',
}));

const ADMIN_SESSION: AdminSession = {
  token: 'abc123',
  storeFqdn: 'my-shop',
};

describe('link', () => {
  const outputMock = mockAndCaptureOutput();

  beforeEach(async () => {
    vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(adminRequest<LinkStorefrontSchema>).mockResolvedValue({
      hydrogenStorefronts: [
        {
          id: 'gid://shopify/HydrogenStorefront/1',
          title: 'Hydrogen',
          productionUrl: 'https://example.com',
        },
      ],
    });
    vi.mocked(getConfig).mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
    outputMock.clear();
  });

  it('makes a GraphQL call to fetch the storefronts', async () => {
    await linkStorefront({});

    expect(adminRequest).toHaveBeenCalledWith(
      LinkStorefrontQuery,
      ADMIN_SESSION,
    );
  });

  it('renders a list of choices and forwards the selection to setStorefront', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue(
      'gid://shopify/HydrogenStorefront/1',
    );

    await linkStorefront({path: 'my-path'});

    expect(setStorefront).toHaveBeenCalledWith('my-path', {
      id: 'gid://shopify/HydrogenStorefront/1',
      title: 'Hydrogen',
      productionUrl: 'https://example.com',
    });
  });

  describe('when there are no Hydrogen storefronts', () => {
    it('renders a message and returns early', async () => {
      vi.mocked(adminRequest<LinkStorefrontSchema>).mockResolvedValue({
        hydrogenStorefronts: [],
      });

      await linkStorefront({});

      expect(outputMock.info()).toMatch(
        /There are no Hydrogen storefronts on your Shop/g,
      );

      expect(renderSelectPrompt).not.toHaveBeenCalled();
      expect(setStorefront).not.toHaveBeenCalled();
    });
  });

  describe('when no storefront gets selected', () => {
    it('does not call setStorefront', async () => {
      vi.mocked(renderSelectPrompt).mockResolvedValue('');

      await linkStorefront({});

      expect(setStorefront).not.toHaveBeenCalled();
    });
  });

  describe('when a linked storefront already exists', () => {
    beforeEach(() => {
      vi.mocked(getConfig).mockResolvedValue({
        storefront: {
          id: 'gid://shopify/HydrogenStorefront/2',
          title: 'Existing Link',
        },
      });
    });

    it('prompts the user to confirm', async () => {
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(true);

      await linkStorefront({});

      expect(renderConfirmationPrompt).toHaveBeenCalledWith({
        message: expect.stringMatching(/Do you want to change storefronts\?/),
      });
    });

    describe('and the user cancels', () => {
      it('returns early', async () => {
        vi.mocked(renderConfirmationPrompt).mockResolvedValue(false);

        await linkStorefront({});

        expect(adminRequest).not.toHaveBeenCalled();
        expect(setStorefront).not.toHaveBeenCalled();
      });
    });

    describe('and the --force flag is provided', () => {
      it('does not prompt the user to confirm', async () => {
        await linkStorefront({force: true});

        expect(renderConfirmationPrompt).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the --storefront flag is provided', () => {
    it('does not prompt the user to make a selection', async () => {
      await linkStorefront({path: 'my-path', storefront: 'Hydrogen'});

      expect(renderSelectPrompt).not.toHaveBeenCalled();
      expect(setStorefront).toHaveBeenCalledWith('my-path', {
        id: 'gid://shopify/HydrogenStorefront/1',
        title: 'Hydrogen',
        productionUrl: 'https://example.com',
      });
    });

    describe('and there is no matching storefront', () => {
      it('renders a warning message and returns early', async () => {
        const outputMock = mockAndCaptureOutput();

        await linkStorefront({storefront: 'Does not exist'});

        expect(setStorefront).not.toHaveBeenCalled();

        expect(outputMock.warn()).toMatch(/Failed to link to storefront/g);
      });
    });
  });
});
