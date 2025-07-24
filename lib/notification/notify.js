import fs from 'fs';
import path from 'path';

/** Read every integration existing in ./adapter **/
const adapterDir = 'adapter';
const adapters = await Promise.all(
  fs
    .readdirSync(path.join(__dirname, 'adapter'))
    .filter((fileName) => fileName.endsWith('.js'))
    .map(async (fileName) => {
      const adapterPath = path.join(adapterDir, fileName);
      return await import(adapterPath);
    }),
);

if (adapters.length === 0) {
  throw new Error('Please specify at least one notification provider');
}
const findAdapter = (notificationAdapter) => {
  return adapters.find((a) => a.config.id === notificationAdapter.id);
};
export const send = (serviceName, newListings, notificationConfig, jobKey) => {
  //this is not being used in tests, therefore adapter are always set
  return notificationConfig
    .filter((notificationAdapter) => findAdapter(notificationAdapter) != null)
    .map((notificationAdapter) => findAdapter(notificationAdapter))
    .map((a) => a.send({ serviceName, newListings, notificationConfig, jobKey }));
};
