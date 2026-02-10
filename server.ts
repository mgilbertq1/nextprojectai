import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

app.listen({ port: env.PORT }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server running at ${address}`);
});
