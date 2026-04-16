// Entry point compatible con IIS Node (iisnode)
// IIS Node asigna el puerto vía process.env.PORT automáticamente
require('dotenv').config();
require('./dist/index.js');