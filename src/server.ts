import { createApp } from './app';

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => console.log(`Pickle C-LB API listening on http://localhost:${port}`));
