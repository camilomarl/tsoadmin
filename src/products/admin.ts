import type { ResourceWithOptions } from 'adminjs';
import { getModelByName } from '@adminjs/prisma';
import { prisma } from '../db.js';

export const productAdminResource = {
  resource: { model: getModelByName('Product'), client: prisma },
  options: {
    properties: {
      id: { isVisible: { list: true, show: true, edit: false, filter: true } },
      createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
      updatedAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
    },
  },
} satisfies ResourceWithOptions;
