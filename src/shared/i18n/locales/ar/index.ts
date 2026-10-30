import type { Catalog } from '../../types';
import app from './app';
import operations from './operations';

/** Arabic catalog: operation definitions plus the rest of the app. */
const catalog: Catalog = { ...operations, ...app };

export default catalog;
