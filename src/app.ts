/* eslint-disable prettier/prettier */

import { JavaCatalog } from "./JavaCatalog";

const catalog = new JavaCatalog();
catalog.parse('./docs/allclasses-index.html');
catalog.save('json');
catalog.save('yml');
