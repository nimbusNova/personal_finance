/** @type {import("drizzle-kit").Config} */
module.exports = {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/personal_finance.db',
  },
};
