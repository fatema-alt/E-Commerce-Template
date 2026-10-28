import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.js';
import { CmsService } from './cms.service.js';
describe.skipIf(!process.env.CMS_TEST_DATABASE_URL)(
  'homepage assignment PostgreSQL',
  () => {
    let db: PrismaClient;
    let service: CmsService;
    let actor: string;
    beforeAll(async () => {
      const url = new URL(process.env.CMS_TEST_DATABASE_URL!);
      if (!url.pathname.startsWith('/commerce_cms_validation_'))
        throw Error('Isolated CMS test database required');
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.$connect();
      service = new CmsService(db as never);
      actor = (
        await db.adminUser.create({
          data: {
            email: randomUUID() + '@homepage.test',
            passwordHash: 'unused',
            role: 'SUPER_ADMIN',
          },
        })
      ).id;
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('keeps unpublished settings private and retains their draft after assignment', async () => {
      const settings = 'settings-' + randomUUID(),
        page = 'page-' + randomUUID();
      const live = {
        storeName: 'Live',
        locale: 'en',
        currency: 'BDT',
        homePageKey: 'home',
      };
      await service.draft('SITE_SETTINGS', settings, live, 0, actor);
      await service.publish('SITE_SETTINGS', settings, 1, actor);
      const draft = { ...live, storeName: 'Private name' };
      await service.draft('SITE_SETTINGS', settings, draft, 2, actor);
      await service.draft(
        'PAGE',
        page,
        { title: 'Landing', sections: [] },
        0,
        actor,
      );
      await service.publish('PAGE', page, 1, actor);
      await service.assignHomepage(settings, page, 3, 2, actor);
      expect(
        (await service.published('SITE_SETTINGS', settings)).content,
      ).toEqual({ ...live, homePageKey: page });
      expect(
        (await service.inspect('SITE_SETTINGS', settings)).latestVersion
          ?.content,
      ).toEqual(draft);
    });
  },
);
