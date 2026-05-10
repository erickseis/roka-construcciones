import pool from '../src/db';
import { cambiarEstadoSolicitudCotizacion } from '../src/services/solicitud_cotizacion.service';

async function test() {
  const id = 27; // SC-027 is Enviada and has no prices
  console.log(`Testing validation for SC-${id}...`);
  try {
    await cambiarEstadoSolicitudCotizacion(id, 'Respondida', null);
    console.error('FAIL: Status changed to Respondida without prices/file!');
  } catch (error: any) {
    console.log(`SUCCESS: Got expected error: ${error.message}`);
  } finally {
    await pool.end();
  }
}

test();
